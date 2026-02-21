import { ReportList } from "./report_list.mjs";

console.log("✅ report_list_bootstrap.mjs loaded");

let isUploadInProgress = false;
let activeXHR = null;

const makeTraceId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const browserLog = (level, event, data = {}) => {
  const payload = {
    ts: new Date().toISOString(),
    event,
    ...data,
  };
  const prefix = "[upload]";
  if (level === "error") {
    console.error(prefix, payload);
  } else if (level === "warn") {
    console.warn(prefix, payload);
  } else {
    console.log(prefix, payload);
  }
};

const OPENAI_STATUS_POLL_MS = 20000;
let openAIStatusIntervalId = null;
let lastOpenAIPollAt = 0;

const triggerConfetti = () => {
  try {
    if (typeof confetti !== "function") return;
    confetti({
      particleCount: 110,
      spread: 70,
      origin: { y: 0.65 },
      disableForReducedMotion: true,
      useWorker: false,
    });
  } catch (error) {
    browserLog("warn", "confetti_blocked", {
      message: error?.message || "Confetti unavailable",
    });
  }
};

function updateOpenAIStatusIndicator(statusData, fetchError = null) {
  const indicator = document.getElementById("openai-status-indicator");
  const label = document.getElementById("openai-status-text");
  if (!indicator || !label) return;

  indicator.classList.remove(
    "openai-status-live",
    "openai-status-down",
    "openai-status-unknown",
  );

  if (fetchError) {
    indicator.classList.add("openai-status-down");
    label.textContent = "OpenAI: Unreachable";
    indicator.title = `OpenAI status check failed: ${fetchError}`;
    return;
  }

  if (statusData?.live) {
    indicator.classList.add("openai-status-live");
    const latency = typeof statusData.latency_ms === "number" ? ` (${statusData.latency_ms}ms)` : "";
    label.textContent = `OpenAI: Live${latency}`;
    indicator.title = `${statusData.detail || "OpenAI available"} • Model: ${statusData.model || "unknown"}`;
    return;
  }

  if (statusData?.configured === false) {
    indicator.classList.add("openai-status-down");
    label.textContent = "OpenAI: Not Configured";
    indicator.title = statusData.detail || "OPENAI_API_KEY is missing";
    return;
  }

  if (statusData?.code === "model_unavailable") {
    indicator.classList.add("openai-status-unknown");
    label.textContent = "OpenAI: Model Unavailable";
    indicator.title = `${statusData.detail || "Configured model is unavailable"}${statusData?.provider_error ? ` • ${statusData.provider_error}` : ""}`;
    return;
  }

  if (statusData?.code === "timeout") {
    indicator.classList.add("openai-status-unknown");
    label.textContent = "OpenAI: Timeout";
    indicator.title = statusData.detail || "OpenAI health check timed out";
    return;
  }

  indicator.classList.add("openai-status-down");
  label.textContent = "OpenAI: Offline";
  indicator.title = `${statusData?.detail || "OpenAI unavailable"}${statusData?.provider_error ? ` • ${statusData.provider_error}` : ""}`;
}

async function pollOpenAIStatus() {
  const now = Date.now();
  if (now - lastOpenAIPollAt < 2500) {
    return;
  }
  lastOpenAIPollAt = now;

  try {
    const response = await fetch("/report/openai/status", {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();
    updateOpenAIStatusIndicator(data);
    browserLog("info", "openai_status_poll", {
      live: data?.live ?? false,
      connected: data?.connected ?? false,
      configured: data?.configured ?? false,
      latency_ms: data?.latency_ms ?? null,
      code: data?.code || null,
      detail: data?.detail || null,
      provider_error: data?.provider_error || null,
    });
  } catch (error) {
    const message = error?.message || "status fetch failed";
    updateOpenAIStatusIndicator(null, message);
    browserLog("error", "openai_status_poll_failed", {
      message,
    });
  }
}

function startOpenAIStatusPolling() {
  pollOpenAIStatus();
  if (openAIStatusIntervalId) {
    clearInterval(openAIStatusIntervalId);
  }
  openAIStatusIntervalId = setInterval(pollOpenAIStatus, OPENAI_STATUS_POLL_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    pollOpenAIStatus();
  });
}

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
startOpenAIStatusPolling();

const uploadModalElement = document.getElementById("summary-upload-modal");

const setUploadModalDismissEnabled = (enabled) => {
  if (!uploadModalElement) return;
  const closeButton = uploadModalElement.querySelector(".btn-close");
  if (closeButton) {
    closeButton.disabled = !enabled;
  }
};

if (uploadModalElement) {
  uploadModalElement.addEventListener("hide.bs.modal", (event) => {
    if (!isUploadInProgress) return;
    event.preventDefault();
    const statusElement = document.getElementById("upload-status");
    if (statusElement) {
      statusElement.innerText =
        "⏳ Upload in progress. Please wait for completion.";
    }
  });
}

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
  const clientTraceId = makeTraceId();
  let serverTraceId = null;

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
  let deferUiResetToPolling = false;
  setUploadModalDismissEnabled(false);

  const resetUploadUiState = () => {
    fileInput.disabled =
      professorInput.disabled =
      courseInput.disabled =
      semesterInput.disabled =
        false;
    uploadBtn.disabled = false;
    uploadBtn.textContent = originalText;
    isUploadInProgress = false;
    activeXHR = null;
    setUploadModalDismissEnabled(true);
  };

  progressContainer.classList.remove("d-none");
  progressBar.style.width = "0%";
  progressBar.setAttribute("aria-valuenow", 0);
  progressBar.classList.remove("bg-danger", "bg-success");
  progressBar.classList.add("bg-primary");
  status.innerText = "🟡 Uploading file...";

  try {
    browserLog("info", "start", {
      client_trace_id: clientTraceId,
      file_name: file?.name || null,
      file_size_bytes: file?.size || 0,
      professor,
      course,
      semester,
    });

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
      xhr.setRequestHeader("X-Client-Trace-Id", clientTraceId);

      xhr.onabort = () => {
        activeXHR = null;
        browserLog("warn", "xhr_aborted", {
          client_trace_id: clientTraceId,
          server_trace_id: serverTraceId,
        });
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
        activeXHR = null;
        serverTraceId = xhr.getResponseHeader("X-Upload-Trace-Id") || serverTraceId;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            uploadResponse = JSON.parse(xhr.responseText);
            serverTraceId = uploadResponse?.trace_id || serverTraceId;
            browserLog("info", "xhr_success", {
              client_trace_id: clientTraceId,
              server_trace_id: serverTraceId,
              status: xhr.status,
              queued: uploadResponse?.queued || false,
              cached: uploadResponse?.cached || false,
              report_id: uploadResponse?.report?.rid || null,
            });
            resolve(uploadResponse);
          } catch (e) {
            browserLog("warn", "xhr_success_non_json", {
              client_trace_id: clientTraceId,
              server_trace_id: serverTraceId,
              status: xhr.status,
              response_text_preview: (xhr.responseText || "").slice(0, 400),
            });
            resolve(null);
          }
        } else {
          browserLog("error", "xhr_failure", {
            client_trace_id: clientTraceId,
            server_trace_id: serverTraceId,
            status: xhr.status,
            status_text: xhr.statusText,
            response_text_preview: (xhr.responseText || "").slice(0, 400),
          });
          reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`));
        }
      };

      xhr.onerror = () => {
        activeXHR = null;
        browserLog("error", "xhr_network_error", {
          client_trace_id: clientTraceId,
          server_trace_id: serverTraceId,
        });
        reject(new Error("Network error during upload"));
      };

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
    let lastLoggedPercent = -1;
    let lastLoggedState = "";
    browserLog("info", "polling_started", {
      client_trace_id: clientTraceId,
      server_trace_id: serverTraceId || uploadResponse?.trace_id || null,
      report_id: reportId || null,
    });
    if (!reportId) {
      // If cached, we're done
      if (uploadResponse?.cached) {
        progressBar.style.width = "100%";
        progressBar.setAttribute("aria-valuenow", 100);
        progressBar.classList.replace("bg-primary", "bg-success");
        status.innerText = "✅ Report already exists. Refresh when ready.";
        resetUploadUiState();
        return;
      }
      // Otherwise, we can't track progress but upload succeeded
      progressBar.style.width = "100%";
      progressBar.setAttribute("aria-valuenow", 100);
      progressBar.classList.replace("bg-primary", "bg-success");
      status.innerText = "✅ Upload complete. Refresh to see updates.";
      resetUploadUiState();
      return;
    }

    progressBar.classList.replace("bg-primary", "bg-info");
    
    let lastPercent = 3;
    let targetPercent = 3;
    let animationFrameId = null;
    const MAX_ERRORS = 8;
    let errorCount = 0;
    let pollingIntervalId = null;
    
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
        if (data?.trace_id && !serverTraceId) {
          serverTraceId = data.trace_id;
        }
        
        const currentPercent = data.percent || 0;
        if (
          data.state !== lastLoggedState ||
          Math.abs(currentPercent - lastLoggedPercent) >= 10 ||
          currentPercent === 100
        ) {
          browserLog("info", "poll_update", {
            client_trace_id: clientTraceId,
            server_trace_id: serverTraceId,
            report_id: reportId,
            state: data.state || null,
            percent: currentPercent,
            eta: data.eta ?? null,
            message: data.message || null,
          });
          lastLoggedState = data.state || "";
          lastLoggedPercent = currentPercent;
        }
        
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
          browserLog("error", "poll_error_state", {
            client_trace_id: clientTraceId,
            server_trace_id: serverTraceId,
            report_id: reportId,
            state: data.state || null,
            error: data.error || data.message || "Unknown error",
          });
          const statusElement = document.getElementById("upload-status");
          if (statusElement) {
            statusElement.innerHTML = `❌ Error: ${data.error || data.message || "Unknown error"}`;
          }
          progressBar.classList.remove("bg-primary", "bg-info", "bg-warning", "bg-success");
          progressBar.classList.add("bg-danger");
          if (pollingIntervalId) {
            clearTimeout(pollingIntervalId);
          }
          resetUploadUiState();
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
          browserLog("info", "poll_complete", {
            client_trace_id: clientTraceId,
            server_trace_id: serverTraceId,
            report_id: reportId,
          });
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
          resetUploadUiState();
          
          // Trigger confetti
          setTimeout(() => {
            triggerConfetti();
          }, 300);
          
          // Reload page after a short delay
          status.innerText = "✅ Upload and processing complete! Refresh to view updated report list.";
        }
      } catch (error) {
        browserLog("error", "poll_exception", {
          client_trace_id: clientTraceId,
          server_trace_id: serverTraceId,
          report_id: reportId,
          message: error?.message || "Unknown polling error",
        });
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
          resetUploadUiState();
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
    deferUiResetToPolling = true;
    pollProgress();

    // Keep modal open during upload so progress remains visible and responsive.
  } catch (error) {
    browserLog("error", "upload_failed", {
      client_trace_id: clientTraceId,
      server_trace_id: serverTraceId,
      message: error?.message || "Unknown upload error",
      stack: error?.stack || null,
    });
    console.error(error);
    status.innerText = "❌ Upload failed. Please try again.";
    progressBar.classList.remove("bg-primary", "bg-warning");
    progressBar.classList.add("bg-danger");
    progressBar.style.width = "100%";
    progressBar.setAttribute("aria-valuenow", 100);
  } finally {
    if (!deferUiResetToPolling) {
      resetUploadUiState();
    }
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
      if (activeXHR.readyState !== XMLHttpRequest.DONE) {
        console.warn("⚠️ Canceling active upload...");
        activeXHR.abort();
      }
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
