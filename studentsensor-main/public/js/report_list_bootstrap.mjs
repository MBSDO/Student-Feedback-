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
    alert("All fields are required. Please fill in all form fields.");
    isUploadInProgress = false;
    return;
  }
  
  // Validate file type
  if (!file.name.toLowerCase().endsWith('.csv')) {
    alert("Please upload a CSV file.");
    isUploadInProgress = false;
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
    // Phase 1: Reading file
    status.innerText = "📖 Reading file...";
    progressBar.style.width = "2%";
    progressBar.setAttribute("aria-valuenow", 2);
    
    const text = await file.text();
    
    // Phase 2: Upload file with XMLHttpRequest
    let uploadResponse = null;
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
          const percent = Math.round((event.loaded / event.total) * 3); // 0-3% for upload
          progressBar.style.width = percent + "%";
          progressBar.setAttribute("aria-valuenow", percent);
          status.innerText = `📤 Uploading file... (${Math.round((event.loaded / event.total) * 100)}%)`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            uploadResponse = JSON.parse(xhr.responseText);
            resolve(uploadResponse);
          } catch (e) {
            resolve(null);
          }
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

    // Phase 3: Poll for real-time progress updates
    const reportId = uploadResponse?.report?.rid;
    if (!reportId) {
      // If cached, we're done
      if (uploadResponse?.cached) {
        progressBar.style.width = "100%";
        progressBar.setAttribute("aria-valuenow", 100);
        progressBar.classList.replace("bg-primary", "bg-success");
        status.innerText = "✅ Report already exists! Loading...";
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        return;
      }
      // Otherwise, we can't track progress but upload succeeded
      progressBar.style.width = "100%";
      progressBar.setAttribute("aria-valuenow", 100);
      progressBar.classList.replace("bg-primary", "bg-success");
      status.innerText = "✅ Upload complete! Processing...";
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    progressBar.classList.replace("bg-primary", "bg-info");
    
    let lastPercent = 3;
    let targetPercent = 3;
    let animationFrameId = null;
    
    // Smooth animation function
    const animateProgress = () => {
      if (lastPercent < targetPercent) {
        const diff = targetPercent - lastPercent;
        // Smooth increment - faster when far apart, slower when close
        const increment = Math.max(0.5, diff / 15);
        lastPercent = Math.min(lastPercent + increment, targetPercent);
        progressBar.style.width = `${lastPercent}%`;
        progressBar.setAttribute("aria-valuenow", Math.round(lastPercent));
        
        if (lastPercent < targetPercent) {
          animationFrameId = requestAnimationFrame(animateProgress);
        }
      }
    };
    
    const pollProgress = async () => {
      try {
        const response = await fetch(`/report/progress/${reportId}`);
        
        if (!response.ok) {
          // If response is not OK, try to get error message
          let errorMessage = `Server error: ${response.status}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, use status text
            errorMessage = response.statusText || errorMessage;
          }
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        const currentPercent = data.percent || 0;
        
        // Update target percent (don't go backwards)
        if (currentPercent > targetPercent) {
          targetPercent = Math.min(currentPercent, 99);
          // Start animation if not already running
          if (!animationFrameId) {
            animationFrameId = requestAnimationFrame(animateProgress);
          }
        }
        
        // Update status message with ETA
        let statusText = data.message || "Processing...";
        if (data.eta !== null && data.eta > 0 && currentPercent < 100) {
          const minutes = Math.floor(data.eta / 60);
          const seconds = data.eta % 60;
          if (minutes > 0) {
            statusText += ` <span class="text-muted">• ETA: ${minutes}m ${seconds}s</span>`;
          } else {
            statusText += ` <span class="text-muted">• ETA: ${seconds}s</span>`;
          }
        }
        
        // Update status
        const statusElement = document.getElementById("upload-status");
        if (statusElement) {
          statusElement.innerHTML = statusText;
        }
        
        // Check for error state
        if (data.state === "error" || data.error) {
          const statusElement = document.getElementById("upload-status");
          if (statusElement) {
            statusElement.innerHTML = `❌ Error: ${data.error || data.message || "Unknown error"}`;
          }
          progressBar.classList.remove("bg-primary", "bg-info", "bg-warning", "bg-success");
          progressBar.classList.add("bg-danger");
          if (pollingIntervalId) {
            clearTimeout(pollingIntervalId);
          }
          return;
        }
        
        // Update progress bar color based on state
        if (data.state) {
          progressBar.classList.remove("bg-primary", "bg-info", "bg-warning", "bg-success", "bg-danger");
          switch(data.state) {
            case "reading_file":
            case "saving_comments":
            case "writing_metadata":
              progressBar.classList.add("bg-info");
              break;
            case "comparing_codebook":
            case "sending_openai":
            case "generating_tags":
            case "placing_tags":
              progressBar.classList.add("bg-warning");
              break;
            case "generating_summary":
            case "finalizing":
              progressBar.classList.add("bg-primary");
              break;
            case "complete":
              progressBar.classList.add("bg-success");
              break;
            default:
              progressBar.classList.add("bg-info");
          }
        }
        
        // Continue polling if not complete
        if (currentPercent < 100) {
          pollingIntervalId = setTimeout(pollProgress, 500); // Poll every 500ms
        } else {
          // Complete! Ensure we're at 100%
          if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
          }
          targetPercent = 100;
          lastPercent = 100;
          progressBar.style.width = "100%";
          progressBar.setAttribute("aria-valuenow", 100);
          progressBar.classList.remove("bg-primary", "bg-info", "bg-warning");
          progressBar.classList.add("bg-success");
          status.innerText = "✅ Upload and processing complete!";
          
          // Trigger confetti
          setTimeout(() => {
            if (typeof confetti === 'function') {
              confetti();
            }
          }, 300);
          
          // Reload page after a short delay
          setTimeout(() => {
            window.location.reload();
          }, 1800);
        }
      } catch (error) {
        console.error("Error polling progress:", error);
        errorCount++;
        
        // Check if we've exceeded max errors
        if (errorCount >= MAX_ERRORS) {
          const statusElement = document.getElementById("upload-status");
          if (statusElement) {
            statusElement.innerHTML = `❌ Failed to track progress after ${MAX_ERRORS} attempts. The upload may have completed. Please refresh the page.`;
          }
          progressBar.classList.remove("bg-primary", "bg-info", "bg-warning", "bg-success");
          progressBar.classList.add("bg-danger");
          if (pollingIntervalId) {
            clearTimeout(pollingIntervalId);
          }
          return;
        }
        
        // Check if it's a network error or server error
        if (error.message && (error.message.includes("fetch") || error.message.includes("Network"))) {
          // Network error - show message but keep trying
          const statusElement = document.getElementById("upload-status");
          if (statusElement) {
            statusElement.innerHTML = `⚠️ Connection issue (${errorCount}/${MAX_ERRORS}). Retrying...`;
          }
          pollingIntervalId = setTimeout(pollProgress, 2000); // Retry after 2 seconds
        } else {
          // Other error - might be server error
          const statusElement = document.getElementById("upload-status");
          if (statusElement) {
            statusElement.innerHTML = `⚠️ Error: ${error.message || "Unknown error"} (${errorCount}/${MAX_ERRORS}). Retrying...`;
          }
          pollingIntervalId = setTimeout(pollProgress, 2000);
        }
      }
    };
    
    // Start polling (pollProgress handles completion and page reload)
    pollProgress();

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
