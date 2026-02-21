import { API } from "/js/utilities.mjs";
import { ReportListItem } from "/js/templates.mjs";
import { escapeHtml } from "/js/security.mjs";

export class ReportList {
  constructor() {
    this.reports = [];
  }

  async Render() {
    console.log("✅ report_list.mjs loaded");

    const createReportButtons = document.querySelectorAll(
      '[role="create-report-button"]'
    );
    createReportButtons.forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const modal = new bootstrap.Modal(
          document.getElementById("summary-upload-modal")
        );
        modal.show();
      });
    });

    try {
      this.reports = await API("/report/list/data", {}, "GET");
    } catch (error) {
      document.getElementById("report-list-spinner").classList.add("d-none");
      document.getElementById("report-list").innerHTML = `
        <div class="text-danger text-center py-5">
          Unable to load reports right now.<br/>
          ${escapeHtml(error?.message || "Please try again in a moment.")}
        </div>
      `;
      return;
    }

    document.getElementById("report-list-spinner").classList.add("d-none");

    if (this.reports.length === 0) {
      document.getElementById("report-list").innerHTML = `
    <div class="text-muted text-center py-5">
      <i class="bi bi-folder2-open fs-1"></i><br/>
      No reports found.<br/>
      Click <i class="bi bi-plus-lg"></i> to create your first report.
    </div>
  `;
    } else {
      this.reports.forEach((report) => {
        RenderRow(report);
      });
    }

    document.getElementById("report-list-options").classList.remove("d-none");

    document.getElementById("editing").addEventListener("change", ToggleEdit);
  }
}

function RenderRow(report) {
  report.date = new Date(report.updated).toLocaleDateString();
  // Escape user-generated content to prevent XSS
  const rowHTML = ReportListItem(report)
    .replace("{{name}}", escapeHtml(report.name))
    .replace("{{rid}}", escapeHtml(String(report.rid)))
    .replace("{{date}}", escapeHtml(report.date))
    .replace("{{comments_count}}", escapeHtml(String(report.comments_count || 0)));
  const rowElement = document.createElement("div");
  rowElement.innerHTML = rowHTML;
  rowElement
    .querySelector(".bi-trash")
    .addEventListener("click", async (event) => {
      await API(`/report/${report.rid}/delete`);
      event.target.closest(".report-list-item").remove();
    });
  document
    .getElementById("report-list")
    .appendChild(rowElement.firstElementChild);
}

function ToggleEdit(event) {
  if (event.target.checked) {
    ToggleEditOn();
  } else {
    ToggleEditOff();
  }
}

function ToggleEditOn() {
  document.querySelectorAll('[role="editing"]').forEach(function (element) {
    element.classList.remove("d-none");
    element.classList.add("d-flex");
  });
}

function ToggleEditOff() {
  document.querySelectorAll('[role="editing"]').forEach(function (element) {
    element.classList.remove("d-flex");
    element.classList.add("d-none");
  });
}
