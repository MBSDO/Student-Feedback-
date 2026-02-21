import { API } from "/js/utilities.mjs";
import { CommentModal } from "/js/comment_modal.mjs";
import { Comment } from "/js/comment.mjs";
import { SentimentChart } from "./sentiment_chart.mjs";
import { escapeHtml } from "/js/security.mjs";

export class Report {
  constructor() {
    this.rid = null;
    this.name = "";
    this.uid = null;
    this.comment_count = 0;
    this.updated = null;
    this.exists = false;
    this.comments = [];
    this.theme_summary = null;
    this.summary_text = null;

    this.table_container = document.getElementById("comment-table-container");
    this.commentList = document.getElementById("comment-table-body");
    this.commentHeader = document.getElementById("comment-table-header");
    this.modal = null;
    this.comment_modal_button = document.getElementById("comment-modal-button");
    this.processing = false;
    this.sentiment_positive_min = 3;
    this.sentiment_negative_max = -3;
    this.name_field = document.getElementById("report-name");
    this.progress_bar = document.getElementById("processing-progress");
    this.progress_bar_label = document.getElementById(
      "processing-progress-label"
    );
    this.chart_button = document.getElementById("chart-button");
    this.chart_container = document.getElementById("main-right");
    this.nullSentimentCount = 0;
    this.active_filters = [];
    this.active_filters_dom = document.getElementById("active-filters");
    this.filter_list_dom = document.getElementById("filter-list");
    this.clear_filters_button = document.getElementById("clear-filters");
    this.slider = null;
    this.slider_element = document.getElementById("sentiment-slider");
    this.download_button = document.querySelector('[role="download-button"]');
    this.clear_all_button = document.getElementById("clear-all-button");
  }

  async Get(rid) {
    this.rid = rid;
    const report = await API(`/report/${this.rid}/view`);
    this.Populate(report);
    this.comments = [];
  }

  Populate(report) {
    for (const [key, value] of Object.entries(report)) {
      if (this.hasOwnProperty(key)) {
        this[key] = value;
      }
    }
  }

  async Render() {
    this.name_field.innerText = this.name;
    if (this.summary_text && typeof this.summary_text === "string") {
      const box = document.getElementById("summary-box");
      const text = document.getElementById("summary-text");
      // Convert markdown bold syntax to HTML (with XSS protection)
      const htmlText = escapeHtml(this.summary_text)
        .trim()
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
      text.innerHTML = htmlText;
      box.classList.remove("d-none");
    }

    await this.GetComments();
    this.RenderComments();
    this.RenderThemeChart();

    if (this.slider_element) {
      if (this.slider) {
        try {
          this.slider.destroy();
        } catch {}
      }

      this.slider = new Slider(this.slider_element, {
        range: true,
        min: -10,
        max: 10,
        step: 1,
        value: [-3, 3],
      });
    } else {
      console.warn("Slider element #sentiment-slider not found.");
    }

    this.Init();

    this.modal = new CommentModal(this, "comment-input-modal");
    if (this.comments.length === 0) this.modal.modal.show();

    this.sentiment_chart = new SentimentChart(
      this,
      "sentiment-chart",
      "total-count",
      "theme-table"
    );
    this.sentiment_chart.Render();
    this.sentiment_chart.Init();

    document.getElementById("main-right").classList.remove("d-none");
    document.getElementById("main-left").classList.remove("d-none");
  }

  Init() {
    const editToggle = document.getElementById("editing");
    if (editToggle) {
      editToggle.addEventListener("change", ToggleEdit);
    } else {
      console.warn("⚠️ Edit toggle (#editing) not found in DOM.");
    }

    document.querySelectorAll('[role="download-button"]').forEach((button) => {
      button.href = `/report/${this.rid}/download`;
    });
    this.name_field.addEventListener("blur", () => {
      this.SaveName();
    });
    this.name_field.addEventListener("keydown", async (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        this.name_field.blur();
      }
    });
    if (this.chart_button) {
      this.chart_button.addEventListener("click", () => {
        this.ToggleChart();
      });
    } else {
      console.warn("⚠️ chart_button (#chart-button) not found in DOM.");
    }

    if (this.comment_modal_button) {
      this.comment_modal_button.addEventListener("click", () => {
        this.modal.modal.show();
      });
    }
    if (this.slider) {
      this.slider.on("slideStop", () => {
        const values = this.slider.getValue();
        this.sentiment_positive_min = values[1];
        this.sentiment_negative_max = values[0];
        API(`/report/${this.rid}/update`, {
          sentiment_positive_min: this.sentiment_positive_min,
          sentiment_negative_max: this.sentiment_negative_max,
        });
        this.comments.forEach((comment) => {
          comment.SetSentimentText();
          comment.UpdateSentiment();
        });
        this.ApplyActiveFilters();
        console.log("Saved");
      });
    }
    this.clear_filters_button.addEventListener("click", () => {
      this.DeactivateAllFilters();
    });
    this.clear_all_button.addEventListener(
      "click",
      this.ClearComments.bind(this)
    );
    this.download_button.addEventListener(
      "click",
      this.DownloadTableAsCSV.bind(this)
    );
    setTimeout(() => this.ProcessComments(), 100);
  }

  ActivateFilter(filter_button, field, value) {
    const filter = this.active_filters.find(
      (f) => f.field === field && f.value === value
    );
    if (filter === undefined) {
      const cancel_button = filter_button.RenderCancelButton();
      this.active_filters.push({ field, value, cancel_button });
      this.active_filters_dom.appendChild(cancel_button);
      this.ApplyActiveFilters();
    } else {
      const deactivationButton = this.active_filters.find(
        (f) => f.value === value
      )?.cancel_button;
      this.DeactivateFilter(deactivationButton, field, value);
    }
  }

  DeactivateAllFilters() {
    this.active_filters = [];
    this.active_filters_dom.innerHTML = "";
    this.ApplyActiveFilters();
  }

  DeactivateFilter(button, field, value) {
    const filter = this.active_filters.find(
      (f) => f.field === field && f.value === value
    );
    if (filter !== undefined) {
      this.active_filters = this.active_filters.filter((f) => f !== filter);
      button.remove();
    }
    this.ApplyActiveFilters();
  }

  ApplyActiveFilters() {
    if (this.active_filters.length > 0) {
      this.comments.forEach((comment) => {
        let show = true;
        comment.dom.classList.add("d-none");

        this.active_filters.forEach((filter) => {
          if (Array.isArray(comment[filter.field])) {
            if (!comment[filter.field].includes(filter.value)) {
              show = false;
            }
          } else {
            if (comment[filter.field] !== filter.value) {
              show = false;
            }
          }
        });

        if (show) {
          comment.dom.classList.remove("d-none");
        }
      });

      this.filter_list_dom.classList.remove("d-none");
    } else {
      this.comments.forEach((comment) => {
        comment.dom.classList.remove("d-none");
      });
      this.filter_list_dom.classList.add("d-none");
    }
  }

  ToggleChart() {
    const sidebar = document.getElementById("main-right-wrapper");
    if (!sidebar) return;
    sidebar.classList.toggle("collapsed-sidebar");
  }

  async GetComments() {
    if (this.comments.length > 0) return this.comments;
    const db_comments = await API(`/report/${this.rid}/comments`, {}, "GET");
    this.comments = db_comments.map((comment) => {
      const newComment = new Comment(this);
      newComment.Populate(comment);
      return newComment;
    });
    return this.comments;
  }

  RenderComments() {
    if (!this.commentList) {
      console.warn(
        "Warning: comment table body element (#comment-table-body) not found."
      );
      return;
    }
    this.commentList.innerHTML = "";
    this.comments.forEach((comment) => {
      this.RenderComment(comment);
    });
  }

  RenderThemeChart() {
    const canvas = document.getElementById("theme-bar-chart");
    const box = document.getElementById("theme-chart-box");
    const sidebar = document.getElementById("main-right");

    if (!canvas || !box || !sidebar) return;

    const themeData = this.theme_summary || {};
    const labels = Object.keys(themeData);
    const values = Object.values(themeData);

    // Skip rendering if empty or zeroed out
    if (labels.length === 0 || values.every((val) => val === 0)) return;

    // Sort data descending by count
    const sorted = labels
      .map((label, i) => ({ label, value: values[i] }))
      .sort((a, b) => b.value - a.value);

    const sortedLabels = sorted.map((x) => x.label);
    const sortedValues = sorted.map((x) => x.value);

    if (this.themeChartInstance) this.themeChartInstance.destroy();

    const ctx = canvas.getContext("2d");
    this.themeChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: sortedLabels,
        datasets: [
          {
            label: "Mentions",
            data: sortedValues,
            backgroundColor: "rgba(54, 162, 235, 0.7)",
          },
        ],
      },
      options: {
        indexAxis: "y", // ✅ Horizontal bars
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.parsed.x} mention(s)`,
            },
          },
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: { precision: 0 },
            title: {
              display: true,
              text: "Mentions",
            },
          },
          y: {
            ticks: {
              font: { size: 12 },
              autoSkip: false,
            },
          },
        },
      },
    });

    box.classList.remove("d-none");
  }

  RenderComment(comment) {
    comment.Render(this.commentList);
  }

  DownloadTableAsCSV() {
    let arr = [];
    this.comments.forEach((comment) => {
      if (comment.dom.classList.contains("d-none")) return;
      const row = [];
      row.push(comment.text);
      row.push(comment.themes_array.join(", "));
      row.forEach((value, index) => {
        if (typeof value === "string") {
          value = MakeValueSafeForCSV(value);
        }
        row[index] = value;
      });
      arr.push(row);
    });
    arr.unshift(["Text", "Themes"]);
    DownloadArrayAsCSV(arr);
  }

  ProcessComments() {
    this.nullSentimentCount = this.comments.filter(
      (comment) => comment.sentiment === null
    ).length;
    if (this.nullSentimentCount > 0) this.ProcessNextComment();
  }

  async ProcessNextComment() {
    this.processing = true;
    const comment = this.comments.find((comment) => comment.sentiment === null);
    if (comment !== undefined) {
      this.SetProgress(
        1 -
          this.comments.filter((comment) => comment.sentiment === null).length /
            this.nullSentimentCount
      );
      await comment.Process();
      this.ApplyActiveFilters();
      setTimeout(() => this.ProcessNextComment(), 100);
    } else {
      this.SetProgress(1);
      this.processing = false;
    }
  }

  SetProgress(progress) {
    if (this.progress_bar === null) return;
    if (progress < 0 || progress === undefined) progress = 0;
    if (progress > 1) progress = 1;
    progress === 1
      ? this.progress_bar.parentElement.parentElement.classList.add("d-none")
      : this.progress_bar.parentElement.parentElement.classList.remove(
          "d-none"
        );
    this.progress_bar.classList.remove("d-none");
    const perc = Math.round(100 * progress);
    perc > 50
      ? this.progress_bar.nextElementSibling.classList.add("d-none")
      : this.progress_bar.nextElementSibling.classList.remove("d-none");
    this.progress_bar.style.width = `${perc}%`;
    this.progress_bar_label.innerText = `${perc}%`;
    this.progress_bar.setAttribute("aria-valuenow", perc);
  }
}

function ToggleEdit(event) {
  if (event.target.checked) ToggleEditOn();
  else ToggleEditOff();
}

function ToggleEditOn() {
  document
    .querySelectorAll('[role="editing"]')
    .forEach((el) => el.classList.remove("d-none"));
}

function ToggleEditOff() {
  document
    .querySelectorAll('[role="editing"]')
    .forEach((el) => el.classList.add("d-none"));
}

function DownloadArrayAsCSV(array) {
  var csvContent = "";
  array.forEach(function (rowArray) {
    var row = rowArray.join(",");
    csvContent += row + "\r\n";
  });
  var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  var link = document.createElement("a");
  if (link.download !== undefined) {
    var url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "data.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

function MakeValueSafeForCSV(str) {
  if (str.includes('"')) {
    str = str.replace(/"/g, '""');
  }
  return `"${str}"`;
}
