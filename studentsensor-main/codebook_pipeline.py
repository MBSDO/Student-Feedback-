import sys
import json
import openai
import os
import io

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
from tiktoken import encoding_for_model, get_encoding
from operator import itemgetter

# Ensure stdout is UTF-8 encoded for emoji support (Node reads stdout)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

# ======= Load environment variables ========
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = (os.getenv("OPENAI_MODEL") or "").strip()
MAX_TOKENS = int(os.getenv("OPENAI_MAX_TOKENS", 300))

client = openai.OpenAI(api_key=OPENAI_API_KEY)

if OPENAI_MODEL:
    try:
        enc = encoding_for_model(OPENAI_MODEL)
    except KeyError:
        # Newer models may not be mapped yet by local tiktoken versions.
        # cl100k_base is a safe tokenizer fallback for budgeting prompt size.
        print(
            f"⚠️ [WARNING] Unknown tokenizer mapping for model '{OPENAI_MODEL}'. Falling back to cl100k_base.",
            file=sys.stderr,
        )
        enc = get_encoding("cl100k_base")
else:
    enc = get_encoding("cl100k_base")
max_prompt_tokens = 10000 # Don't remove (used in coding batch calls)
max_for_summary = 500

# ==========================================

def build_recoding_prompt(batch, codebook, just_header=False):
    prompt = f"""
You are a qualitative researcher analyzing individual student comments to identify specific themes.
For each batch, carefully read each individual comment, then identify the most relevant theme(s) from the codebook below. Each comment should be analyzed independently - don't group similar or subsequent comments together.

The codebook below contains a list of categories. Each category includes:
- A definition of what the category means
- Two or three example student comments

CODEBOOK:
\"\"\"
{json.dumps(codebook, indent=2)}
\"\"\"
Instructions:
- Analyze each comment individually and independently
- Look at the specific content of each comment, not patterns across comments
- Assign 1-3 most relevant themes per comment based on the actual content
- If a comment doesn't clearly fit any theme, assign an empty array []
- Be precise - don't force comments into themes that don't match
Return your answer in strict JSON like this:
{{
  "Comment 1": ["clarity", "engagement"],
  "Comment 2": [],
  ...
}}
Now analyze each of these comments individually:
"""
    for i, entry in enumerate(batch, start=1):
        prompt += f"\nComment {i}:\nQuestion: {entry['subject']}\nResponse: {entry['text']}\n"
    return prompt



def build_summary_prompt(top_themes, comments_by_theme):
    theme_list = ", ".join(top_themes.keys())
    
    # Build comment examples for each theme
    comment_examples = ""
    for theme in top_themes.keys():
        comments = comments_by_theme.get(theme, [])
        if comments:
            # Take up to 3 example comments per theme
            examples = comments[:3]
            comment_examples += f"\n**{theme}** (mentioned {top_themes[theme]} times):\n"
            for i, comment in enumerate(examples, 1):
                comment_examples += f"  {i}. \"{comment}\"\n"
    
    prompt = (
        "You are summarizing student feedback themes for a college course.\n"
        "Take these top 5 most frequently mentioned themes. For each theme:\n"
        "- Start with the theme title as a bold heading (use markdown **bold**).\n"
        "- Then write a 2-3 sentence paragraph summarizing how that theme showed up in the feedback.\n"
        "Keep the tone professional, clear, and concise.\n\n"
        f"Top themes to analyze: {theme_list}\n\n"
        f"Here are example comments for each theme:{comment_examples}\n"
        "Provide a structured summary based on these specific comments and themes from the student feedback."
    )
    return prompt

def summarize_with_openai(prompt):
    def _extract_text(response_obj):
        try:
            msg = response_obj.choices[0].message
            content = getattr(msg, "content", None)
            if isinstance(content, str):
                return content.strip()
            if isinstance(content, list):
                parts = []
                for part in content:
                    text = getattr(part, "text", None)
                    if isinstance(text, str):
                        parts.append(text)
                    elif isinstance(part, dict) and isinstance(part.get("text"), str):
                        parts.append(part["text"])
                return "".join(parts).strip()
        except Exception:
            return ""
        return ""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes student feedback."},
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=max_for_summary
        )
        text = _extract_text(response)
        if text:
            return text
        raise ValueError("OpenAI returned empty summary output.")
    except Exception as e:
        if "max_completion_tokens" in str(e):
            try:
                response = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[
                        {"role": "system", "content": "You are a helpful assistant that summarizes student feedback."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=max_for_summary
                )
                text = _extract_text(response)
                if text:
                    return text
                raise ValueError("OpenAI returned empty summary output.")
            except Exception as inner_error:
                return f"Error summarizing with OpenAI: {str(inner_error)}"
        return f"Error summarizing with OpenAI: {str(e)}"

def build_fallback_analysis(top_themes, comments_by_theme):
    if not top_themes:
        return "No themes were identified in the student feedback."

    lines = [
        "The feedback shows several recurring patterns across student comments."
    ]
    for theme, count in top_themes.items():
        examples = comments_by_theme.get(theme, [])[:2]
        snippet_parts = []
        for raw in examples:
            text = str(raw or "").strip().replace("\n", " ")
            if text:
                snippet_parts.append(f"\"{text[:140]}{'...' if len(text) > 140 else ''}\"")

        lines.append(f"**{theme}**")
        lines.append(
            f"This theme appears {count} time{'s' if count != 1 else ''} and indicates a consistent student signal in this area."
        )
        if snippet_parts:
            lines.append(f"Representative feedback included {', '.join(snippet_parts)}.")
        else:
            lines.append("Representative comments were limited, but the coded frequency suggests this area deserves attention.")

    return "\n\n".join(lines)

def extract_top_5(themes_summary):
    sorted_themes = sorted(themes_summary.items(), key=itemgetter(1), reverse=True)
    return dict(sorted_themes[:5])

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing input file. Usage: python codebook_pipeline.py themes_summary.json"}))
        return
    if not OPENAI_MODEL:
        print(json.dumps({"error": "OPENAI_MODEL is not configured."}))
        return

    input_path = sys.argv[1]
    print(f"🔍 [DEBUG] Processing input file: {input_path}", file=sys.stderr)

    try:
        with open(input_path, "r", encoding="utf-8") as f:
            full_data = json.load(f)

        themes_summary = full_data.get("themes", {})
        comments_by_theme = full_data.get("comments_by_theme", {})

        print(f"🔍 [DEBUG] Found {len(themes_summary)} themes in summary", file=sys.stderr)
        print(f"🔍 [DEBUG] Theme counts: {themes_summary}", file=sys.stderr)
        print(f"🔍 [DEBUG] Comments by theme keys: {list(comments_by_theme.keys())}", file=sys.stderr)

        top_themes = extract_top_5(themes_summary)
        print(f"🔍 [DEBUG] Top 5 themes: {top_themes}", file=sys.stderr)

        if not top_themes:
            print("⚠️ [WARNING] No themes found for summary generation", file=sys.stderr)
            summary = "No themes were identified in the student feedback."
        else:
            prompt = build_summary_prompt(top_themes, comments_by_theme)
            print(f"🔍 [DEBUG] Generated prompt length: {len(prompt)} characters", file=sys.stderr)
            summary = summarize_with_openai(prompt)
            if not summary or summary.startswith("Error summarizing with OpenAI:"):
                print("⚠️ [WARNING] OpenAI summary failed/empty. Using deterministic analysis fallback.", file=sys.stderr)
                summary = build_fallback_analysis(top_themes, comments_by_theme)
            print(f"🔍 [DEBUG] Generated summary length: {len(summary)} characters", file=sys.stderr)

        related_comments = {theme: comments_by_theme.get(theme, []) for theme in top_themes.keys()}

        output = {
            "summary": summary,
            "top_5_themes": top_themes,
            "related_comments": related_comments
        }

        # ✅ Only one clean JSON output to stdout
        print(json.dumps(output, indent=2))

    except Exception as e:
        print(f"❌ [ERROR] Error in main: {str(e)}", file=sys.stderr)
        print(json.dumps({"error": str(e)}))

def run_open_coding():
    try:
        if not OPENAI_MODEL:
            print("Error in open coding: OPENAI_MODEL is not configured.", file=sys.stderr)
            return

        with open("standardized_codebook.json", "r", encoding="utf-8") as f:
            raw_codebook = json.load(f)

        codebook_dict = {
        entry["category"]: {
            "definition": entry["definition"],
            "examples": entry["examples"]
        }
        for entry in raw_codebook
        }

        report_id = sys.argv[2] if len(sys.argv) > 2 else None

        conn = psycopg2.connect(
            host=os.getenv("DB_HOST"),
            port=os.getenv("DB_PORT"),
            dbname=os.getenv("DB_NAME"),
            user=os.getenv("DB_USER"),
            password=os.getenv("DB_PW"),
            sslmode="require" if os.getenv("DB_SSL", "false").lower() == "true" else "disable",
            cursor_factory=RealDictCursor
        )

        cursor = conn.cursor()
        if report_id:
            print(f"🟢 Running open coding for report_id: {report_id}", file=sys.stderr)
            cursor.execute(
                """
                SELECT c.cid, c.text
                FROM comments c
                LEFT JOIN comments_settings cs
                  ON cs.cid = c.cid
                 AND cs.name = 'categories'
                WHERE c.rid = %s
                  AND c.text IS NOT NULL
                  AND cs.cid IS NULL;
                """,
                (report_id,)
            )
        else:
            print("🟡 Running open coding for ALL comments (no report_id provided)", file=sys.stderr)
            cursor.execute(
                """
                SELECT c.cid, c.text
                FROM comments c
                LEFT JOIN comments_settings cs
                  ON cs.cid = c.cid
                 AND cs.name = 'categories'
                WHERE c.text IS NOT NULL
                  AND cs.cid IS NULL;
                """
            )

        rows = cursor.fetchall()



        base_prompt = build_recoding_prompt([], codebook_dict, just_header=True)
        base_tokens = len(enc.encode(base_prompt))

        i = 0
        total_written = 0

        while i < len(rows):
            token_budget = max_prompt_tokens - base_tokens
            batch = []
            prompt_body = ""

            while i < len(rows):
                comment_text = f"\nComment {len(batch)+1}:\n{rows[i]['text']}\n"
                comment_tokens = len(enc.encode(comment_text))

                if token_budget - comment_tokens <= 0:
                    break

                prompt_body += comment_text
                token_budget -= comment_tokens
                batch.append(rows[i])
                i += 1

            full_prompt = base_prompt + prompt_body

            try:
                response = client.chat.completions.create(
                    model=OPENAI_MODEL,
                    messages=[{"role": "user", "content": full_prompt}],
                )
                raw_response = response.choices[0].message.content.strip()

                try:
                    result = json.loads(raw_response)
                except json.JSONDecodeError as e:
                    print(f"❌ JSON decode error on batch starting at row {i}: {e}", file=sys.stderr)
                    print("🔍 Raw GPT response was:", raw_response[:500], "...", file=sys.stderr)  # show first 500 chars
                    continue  # skip this batch

                updates = [
                    (json.dumps(result.get(f"Comment {j+1}", [])), entry["cid"])
                    for j, entry in enumerate(batch)
                ]

                cursor.executemany(
                    """
                    INSERT INTO comments_settings (cid, name, value)
                    VALUES (%s, 'categories', %s)
                    ON CONFLICT (cid, name) DO UPDATE
                    SET value = EXCLUDED.value
                    """,
                    [(cid, categories_json) for categories_json, cid in updates]
                )
                conn.commit()
                total_written += len(updates)

            except Exception as e:
                print(f"Error on batch starting at row {i}: {e}", file=sys.stderr)

        print(f"Open coding complete. {total_written} comments updated.", file=sys.stderr)

    except Exception as e:
        print(f"Error in open coding: {e}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) >= 2:
        main()
    else:
        run_open_coding()
