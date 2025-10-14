export class FilterButton {
  constructor(report, field, value, btnClass = "btn-light") {
    this.report = report;
    this.field = field;
    this.value = value;
    this.btnClass = btnClass;
    this.dom = null;
    this.Render();
    // this.Init();
  }
  Render() {
    this.dom = document.createElement("button");
    this.dom.classList.add(
      "btn",
      "rounded-pill",
      "m-1",
      "btn-light",
      this.btnClass
    );
    this.dom.innerText = this.value;
    this.dom.setAttribute("role", "filter-button");
    // ✅ Add this so clicks actually trigger filtering
    this.dom.addEventListener("click", () => {
      console.log("🟢 Filter clicked:", this.field, this.value);
      this.report.ActivateFilter(this, this.field, this.value);
    });
    return this.dom;
  }
  RenderCancelButton() {
    const cancel_button = document.createElement("button");
    cancel_button.classList.add(
      "btn",
      "rounded-pill",
      "m-1",
      "btn-light",
      this.btnClass
    );
    cancel_button.innerText = `${this.value}`;
    const icon = document.createElement("span");
    icon.classList.add("bi-x-lg", "ms-2", "opacity-50");
    cancel_button.appendChild(icon);
    cancel_button.setAttribute("role", "filter-button-cancel");
    cancel_button.setAttribute("aria-label", `Cancel ${this.value}`);
    cancel_button.addEventListener("click", () => {
      this.report.DeactivateFilter(cancel_button, this.field, this.value);
      cancel_button.remove();
    });
    return cancel_button;
  }
  Init() {
    this.dom.addEventListener("click", () => {
      this.report.ActivateFilter(this, this.field, this.value);
    });
  }
}
