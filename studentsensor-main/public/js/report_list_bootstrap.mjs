import { ReportList } from "./report_list.mjs";

console.log("✅ report_list_bootstrap.mjs loaded");

let isUploadInProgress = false;
let activeXHR = null;

new ReportList().Render();

// Tooltip setup
const tooltipTriggerList = document.querySelectorAll(
  '[data-bs-toggle="tooltip"]'
);
[...tooltipTriggerList].forEach(
  (tooltipTriggerEl) =>
    new bootstrap.Tooltip(tooltipTriggerEl, {
      delay: { show: 500, hide: 100 },
    })
);

// Upload modal logic with staged progress + simulated backend processing
document.getElementById("upload-submit").addEventListener("click", async () => {
  if (isUploadInProgress) return; // Prevent duplicate submits
  isUploadInProgress = true;

  const fileInput = document.getElementById("upload-file");
  const professorInput = document.getElementById("upload-professor");
  const courseInput = document.getElementById("upload-course");
  const semesterInput = document.getElementById("upload-semester");
  const status = document.getElementById("upload-status");
  const progressBar = document.getElementById("upload-progress-bar");
  const progressContainer = document.getElementById(
    "upload-progress-container"
  );

  const file = fileInput.files[0];
  const professor = professorInput.value.trim();
  const course = courseInput.value.trim();
  const semester = semesterInput.value.trim();

  if (!file || !professor || !course || !semester) {
    alert("All fields are required.");
    return;
  }

  fileInput.disabled =
    professorInput.disabled =
    courseInput.disabled =
    semesterInput.disabled =
      true;

  const uploadBtn = document.getElementById("upload-submit");
  uploadBtn.disabled = true;
  const originalText = uploadBtn.textContent;
  uploadBtn.textContent = "Uploading...";

  progressContainer.classList.remove("d-none");
  progressBar.style.width = "0%";
  progressBar.setAttribute("aria-valuenow", 0);
  progressBar.classList.remove("bg-danger", "bg-success");
  progressBar.classList.add("bg-primary");
  status.innerText = "🟡 Uploading file...";

  try {
    const text = await file.text();

    // Phase 1: Upload file with XMLHttpRequest (progress bar 0–30%)
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      activeXHR = xhr;
      xhr.open("POST", "/report/upload");
      xhr.setRequestHeader("Content-Type", "application/json");

      xhr.onabort = () => {
        status.innerText = "⚠️ Upload canceled.";
        progressBar.classList.add("bg-danger");
        reject(new Error("Upload canceled"));
      };

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 30);
          progressBar.style.width = percent + "%";
          progressBar.setAttribute("aria-valuenow", percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => reject(new Error("Network error during upload"));

      const body = JSON.stringify({
        professor,
        course_code: course,
        semester,
        csv_text: text,
      });

      xhr.send(body);
    });

    // Phase 2: Simulate processing progress (30% → 99%)
    status.innerText =
      "⚙️ Processing feedback (this may take 10–20 seconds)...";
    progressBar.classList.replace("bg-primary", "bg-warning");

    let fakeProgress = 30;
    const interval = setInterval(() => {
      fakeProgress += Math.random() * 5; // gradual, irregular increments
      if (fakeProgress >= 99) {
        fakeProgress = 99;
        clearInterval(interval);
      }
      progressBar.style.width = `${fakeProgress}%`;
      progressBar.setAttribute("aria-valuenow", fakeProgress);
    }, 500);

    // Wait for real processing (simulate backend delay)
    await new Promise((r) => setTimeout(r, 4000));

    // Phase 3: Finalize
    clearInterval(interval);
    progressBar.style.width = "100%";
    progressBar.setAttribute("aria-valuenow", 100);
    progressBar.classList.replace("bg-warning", "bg-success");
    status.innerText = "✅ Upload and processing complete!";

    const modal = bootstrap.Modal.getInstance(
      document.getElementById("summary-upload-modal")
    );
    modal?.hide();

    setTimeout(() => {
      confetti();
    }, 300);

    setTimeout(() => {
      window.location.reload();
    }, 1800);
  } catch (error) {
    console.error(error);
    status.innerText = "❌ Upload failed. Please try again.";
    progressBar.classList.remove("bg-primary", "bg-warning");
    progressBar.classList.add("bg-danger");
    progressBar.style.width = "100%";
    progressBar.setAttribute("aria-valuenow", 100);
  } finally {
    fileInput.disabled =
      professorInput.disabled =
      courseInput.disabled =
      semesterInput.disabled =
        false;
    uploadBtn.disabled = false;
    uploadBtn.textContent = originalText;
    isUploadInProgress = false;
    activeXHR = null;
  }
});

// ✅ Reset modal form when it's closed (cancel, ESC, backdrop)
document
  .getElementById("summary-upload-modal")
  .addEventListener("hidden.bs.modal", () => {
    const fileInput = document.getElementById("upload-file");
    const professorInput = document.getElementById("upload-professor");
    const courseInput = document.getElementById("upload-course");
    const semesterInput = document.getElementById("upload-semester");
    const status = document.getElementById("upload-status");
    const progressBar = document.getElementById("upload-progress-bar");
    const progressContainer = document.getElementById(
      "upload-progress-container"
    );
    const uploadBtn = document.getElementById("upload-submit");

    if (isUploadInProgress && activeXHR) {
      console.warn("⚠️ Canceling active upload...");
      activeXHR.abort();
      isUploadInProgress = false;
      activeXHR = null;
    }

    // Reset field values
    fileInput.value = "";
    professorInput.value = "";
    courseInput.value = "";
    semesterInput.value = "";

    // Re-enable fields and button
    fileInput.disabled = false;
    professorInput.disabled = false;
    courseInput.disabled = false;
    semesterInput.disabled = false;
    uploadBtn.disabled = false;
    uploadBtn.textContent = "Upload";

    // Reset progress bar and container
    progressContainer.classList.add("d-none");
    progressBar.style.width = "0%";
    progressBar.setAttribute("aria-valuenow", "0");
    progressBar.classList.remove(
      "bg-danger",
      "bg-success",
      "bg-warning",
      "bg-primary"
    );

    // Reset status text
    status.innerText = "Waiting to upload...";
  });
