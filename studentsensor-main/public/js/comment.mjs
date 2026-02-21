import { API } from "/js/utilities.mjs";
import { CommentRow, Placeholder } from "/js/templates.mjs";
import { FilterButton } from "/js/filter_button.mjs";
import { escapeHtml } from "/js/security.mjs";

export class Comment {
  constructor(report) {
    this.report = report;
    this.cid = null;
    this.rid = null;
    this.uid = null;
    this.text = "";
    this.sentiment = null;
    this.sentiment_text = null;
    this.civility = null;
    this.aims = null;
    this.themes = null;
    this.subject = null;
    this.created = null;
    this.exists = false;
    this.dom = null;
    this.sentiment_text = null;
    this.civility_text = null;
    this.aims_array = [];
    this.themes_array = [];
    this.subject_array = [];
    this.categories = []; // ✅ GPT-recoded tags
  }

  async Get(cid) {
    this.cid = cid;
    const comment = await API(`/comment/${this.cid}`);
    this.Populate(comment);
    this.exists = true;
  }

  Populate(comment) {
    for (const [key, value] of Object.entries(comment)) {
      if (this.hasOwnProperty(key)) {
        this[key] = value;
      }
    }
    this.SetSentimentText();
    this.SetCivilityText();
    this.SetAimsArray();
    this.SetThemesArray();
    this.SetSubjectArray();
    this.SetCategoriesArray(); // Add this line
  }

  Render(container) {
    const rowElement = document.createElement("tbody");
    const commentRow = CommentRow(this);
    rowElement.innerHTML = commentRow;
    this.dom = rowElement.firstElementChild;
    container.appendChild(this.dom);
    rowElement.remove();
    this.UpdateRow();
    this.Init();
  }

  UpdateRow() {
    this.dom.querySelector('[role="text"]').innerText = this.text;
    this.UpdateSentiment();
    this.CivilityHTML();
    this.AimsHTML();
    this.ThemesHTML();
    this.CategoriesHTML();
    this.SubjectHTML();
  }

  UpdateSentiment() {
    this.SentimentHTML();
  }

  SetSentimentText() {
    if (this.sentiment === undefined || this.sentiment === null) {
      this.sentiment_text = "";
    } else if (this.sentiment > this.report.sentiment_positive_min) {
      this.sentiment_text = "Positive";
    } else if (this.sentiment < this.report.sentiment_negative_max) {
      this.sentiment_text = "Negative";
    } else {
      this.sentiment_text = "Neutral";
    }
    return this.sentiment_text;
  }
  SentimentHTML() {
    const selector = '[role="sentiment"]';
    const domElement = this.dom.querySelector(selector);

    if (this.sentiment === undefined || this.sentiment === null) {
      domElement.innerHTML = ""; // data hasn't arrived yet
      return;
    }
    domElement.innerHTML = "";
    const btnClass =
      this.sentiment_text === "Positive"
        ? "text-byu"
        : this.sentiment_text === "Negative"
        ? "text-byu-burgundy-dark"
        : "btn-light";

    const button = new FilterButton(
      this.report,
      "sentiment_text",
      this.sentiment_text,
      btnClass
    );
    domElement.appendChild(button.dom);
  }

  SetCivilityText() {
    if (this.civility === undefined || this.civility === null) {
      this.civility_text = "";
    } else if (this.civility > 3) {
      this.civility_text = "Civil";
    } else if (this.civility < -3) {
      this.civility_text = "Uncivil";
    } else {
      this.civility_text = "Unclear";
    }
    return this.civility_text;
  }

  CivilityHTML() {
    const selector = '[role="civility"]';
    const domElement = this.dom.querySelector(selector);
    if (this.civility === undefined || this.civility === null) {
      domElement.innerHTML = Placeholder;
      return;
    }
    domElement.innerHTML = "";
    const btnClass =
      this.civility_text == "Civil"
        ? "text-byu"
        : this.civility_text == "Uncivil"
        ? "text-byu-burgundy-dark"
        : "btn-light";
    const button = new FilterButton(
      this.report,
      "civility_text",
      this.civility_text,
      btnClass
    );
    domElement.appendChild(button.dom);
  }

  SetAimsArray() {
    if (this.aims === undefined || this.aims === null) {
      this.aims_array = [];
      return;
    }
    this.aims_array = this.aims
      .split(",")
      .map((aim) => aim.trim())
      .filter((aim) => aim !== "");
  }

  AimsHTML() {
    const selector = '[role="aims"]';
    const domElement = this.dom.querySelector(selector);
    if (this.aims === undefined || this.aims === null) {
      domElement.innerHTML = Placeholder;
      return;
    }
    domElement.innerHTML = "";
    this.aims_array.forEach((aim) => {
      if (aim === undefined || aim === null || aim === "") return;
      const button = new FilterButton(this.report, "aims_array", aim);
      domElement.appendChild(button.dom);
    });
  }

  SetThemesArray() {
    if (this.themes === undefined || this.themes === null) {
      this.themes_array = [];
      return;
    }
    this.themes_array = this.themes
      .split(",")
      .map((theme) => theme.trim())
      .filter((theme) => theme !== "");
  }
  CategoriesHTML() {
    const selector = '[role="categories"]';
    const domElement = this.dom.querySelector(selector);

    // Always clear out the placeholder first
    domElement.innerHTML = "";

    if (!Array.isArray(this.categories) || this.categories.length === 0) {
      domElement.innerHTML = Placeholder;
      return;
    }

    this.categories.forEach((category) => {
      if (!category) return;
      const button = new FilterButton(this.report, "categories", category);
      domElement.appendChild(button.dom);
    });
  }

  ThemesHTML() {
    const selector = '[role="themes"]';
    const domElement = this.dom.querySelector(selector);
    if (this.themes === undefined || this.themes === null) {
      domElement.innerHTML = Placeholder;
      return;
    }
    domElement.innerHTML = "";
    this.themes_array.forEach((theme) => {
      if (theme === undefined || theme === null || theme === "") return;
      const button = new FilterButton(this.report, "themes_array", theme);
      domElement.appendChild(button.dom);
    });
  }

  SetSubjectArray() {
    if (this.subject === undefined || this.subject === null) {
      this.subject_array = [];
      return;
    }
    this.subject_array = this.subject
      .split(",")
      .map((subject) => subject.trim())
      .filter((subject) => subject !== "");
  }

  SetCategoriesArray() {
    if (this.categories === undefined || this.categories === null) {
      this.categories = [];
      return;
    }
    
    try {
      // Try to parse as JSON first
      if (typeof this.categories === 'string') {
        this.categories = JSON.parse(this.categories);
      } else if (Array.isArray(this.categories)) {
        // Already an array, no need to parse
        return;
      } else {
        // Fallback: try comma-separated string
        this.categories = this.categories.split(",").map((c) => c.trim()).filter((c) => c !== "");
      }
    } catch (err) {
      console.warn(`⚠️ Failed to parse categories for comment ${this.cid}:`, err.message);
      // Fallback: try comma-separated string
      this.categories = this.categories.split(",").map((c) => c.trim()).filter((c) => c !== "");
    }
  }

  SubjectHTML() {
    const selector = '[role="subject"]';
    const domElement = this.dom.querySelector(selector);
    if (this.subject === undefined || this.subject === null) {
      domElement.innerHTML = Placeholder;
      return;
    }
    domElement.innerHTML = "";
    this.subject_array.forEach((subject) => {
      if (subject === undefined || subject === null || subject === "") return;
      const button = new FilterButton(this.report, "subject_array", subject);
      domElement.appendChild(button.dom);
    });
  }

  Init() {
    this.dom
      .querySelector('[role="delete"]')
      .addEventListener("click", async () => {
        try {
          this.Delete();
        } catch (error) {
          console.error("Error deleting comment:", error);
        }
      });

    this.dom
      .querySelector('[role="process"]')
      .addEventListener("click", async () => {
        try {
          this.Populate(await API(`/comment/${this.cid}/clear`));
          this.UpdateRow();
          if (!this.report.processing) this.report.ProcessComments();
        } catch (error) {
          console.error("Error processing comment:", error);
        }
      });
  }

  async Delete() {
    await API(`/comment/${this.cid}/delete`);
    this.dom.remove();
    this.report.comments = this.report.comments.filter(
      (c) => c.cid !== this.cid
    );
    this.report.ApplyActiveFilters();
  }

  ClearValues() {
    API(`/comment/${this.cid}/clear`);
    this.dom.querySelector('[role="sentiment"]').innerText = "-";
    this.dom.querySelector('[role="civility"]').innerText = "-";
    this.dom.querySelector('[role="aims"]').innerText = "-";
    this.dom.querySelector('[role="themes"]').innerText = "-";
    this.dom.querySelector('[role="categories"]').innerText = "-"; // ✅ reset
    this.dom.querySelector('[role="subject"]').innerText = "-";
    this.report.ApplyActiveFilters();
  }

  async Process() {
    console.log("Processing comment", this.cid);
    const response = await API(`/comment/${this.cid}/process`);
    this.Populate(response);
    this.UpdateRow();
  }
}
