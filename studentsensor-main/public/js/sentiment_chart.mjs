import { FilterButton } from "/js/filter_button.mjs";
export class SentimentChart {
  constructor(
    report,
    containerSelector,
    total_count_selector,
    theme_table_selector
  ) {
    this.report = report;
    this.chart = null;
    this.dom = null;
    this.container = null;
    this.container = document.getElementById(containerSelector);
    this.status = false;
    this.total_count_display = document.getElementById(total_count_selector);
    this.theme_table = document.getElementById(theme_table_selector);
  }

  Render() {
    const div = document.createElement("div");
    div.classList.add("p-2");
    this.container.appendChild(div);
    this.dom = document.createElement("canvas");
    div.appendChild(this.dom);
    this.chart = new Chart(this.dom, {
      type: "doughnut",
      data: {
        labels: ["Negative", "Neutral", "Positive"],
        datasets: [
          {
            data: [0, 0, 0],
            borderWidth: 1,
            backgroundColor: ["#9E2A2B", "#C7C9C7", "#0047BA"],
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: "bottom",
          },
        },
      },
    });
    document
      .getElementById("positive-count-label")
      .appendChild(
        new FilterButton(this.report, "sentiment_text", "Positive", "text-byu")
          .dom
      );
    document
      .getElementById("negative-count-label")
      .appendChild(
        new FilterButton(
          this.report,
          "sentiment_text",
          "Negative",
          "text-byu-burgundy-dark"
        ).dom
      );
    document
      .getElementById("neutral-count-label")
      .appendChild(
        new FilterButton(this.report, "sentiment_text", "Neutral").dom
      );
    this.container.classList.contains("d-none")
      ? this.report.ToggleChartOff()
      : this.report.ToggleChartOn();
  }
  Init() {}
  async UpdateData() {
    return new Promise((resolve) => {
      if (!this.container || this.container.classList.contains("d-none"))
        return;
      let data = [0, 0, 0];
      document.querySelectorAll('[role="sentiment"]').forEach((e) => {
        if (e.closest("tr").classList.contains("d-none")) return;
        const v = e.innerText;
        switch (v) {
          case "Negative":
            data[0]++;
            break;
          case "Positive":
            data[2]++;
            break;
          default:
            data[1]++;
            break;
        }
      });
      this.chart.data.datasets[0].data = data;
      this.chart.update();
      resolve(true);
    });
  }

  async UpdateThemeTable() {
    return new Promise((resolve) => {
      this.theme_table.innerHTML = "";

      let themes = {};
      let comment_count = 0;

      // Option A: use preloaded summary if available
      if (this.report.theme_summary) {
        themes = this.report.theme_summary;
        comment_count = this.report.comments.filter(
          (c) => !c.dom.classList.contains("d-none")
        ).length;
      } else {
        // Fallback to parsing individual comments
        this.report.comments.forEach((comment) => {
          if (comment.dom.classList.contains("d-none")) return;
          comment_count++;
          if (!comment.themes_array?.length) return;
          comment.themes_array.forEach((theme) => {
            if (!themes[theme]) themes[theme] = 0;
            themes[theme]++;
          });
        });

        // Sort manually since raw JSON is not sorted
        themes = Object.fromEntries(
          Object.entries(themes).sort((a, b) => b[1] - a[1])
        );
      }

      this.total_count_display.innerText = comment_count;

      for (const [theme, count] of Object.entries(themes)) {
        const row = document.createElement("tr");
        row.classList.add("align-middle");

        const cell1 = document.createElement("td");
        const button = new FilterButton(this.report, "themes_array", theme);
        cell1.appendChild(button.dom);

        const cell2 = document.createElement("td");
        cell2.classList.add("text-center");
        cell2.innerText = count;

        row.appendChild(cell1);
        row.appendChild(cell2);
        this.theme_table.appendChild(row);
      }

      // Update sentiment counts (unchanged)
      const positiveCount = this.report.comments.filter(
        (c) =>
          c.sentiment_text === "Positive" && !c.dom.classList.contains("d-none")
      ).length;
      const negativeCount = this.report.comments.filter(
        (c) =>
          c.sentiment_text === "Negative" && !c.dom.classList.contains("d-none")
      ).length;
      const neutralCount = this.report.comments.filter(
        (c) =>
          c.sentiment_text === "Neutral" && !c.dom.classList.contains("d-none")
      ).length;

      document.getElementById("positive-count").innerText = positiveCount;
      document.getElementById("negative-count").innerText = negativeCount;
      document.getElementById("neutral-count").innerText = neutralCount;

      resolve(true);
    });
  }
}
