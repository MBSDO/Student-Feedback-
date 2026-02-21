export async function API(url, data = {}, method = "POST", config = {}) {
  console.log("📡 API called with URL:", url);

  return new Promise(async (resolve, reject) => {
    const startTime = Date.now();
    try {
      const options = {
        method,
        headers: {},
      };

      // For GET requests, send no body, but accept JSON response
      if (method === "GET") {
        options.headers["Accept"] = "application/json";
      } else {
        options.headers["Content-Type"] = "application/json";
        if (data && Object.keys(data).length > 0) {
          options.body = JSON.stringify(data);
        }
      }

      if (config && config.headers && typeof config.headers === "object") {
        options.headers = { ...options.headers, ...config.headers };
      }

      const response = await fetch(url, options);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        const text = await response.text();
        console.error("❌ Expected JSON but got:", text);
        return reject(new Error("Server returned non-JSON response"));
      }

      const json = await response.json();

      if (response.ok) {
        console.log(
          `✅ API execution time: ${(Date.now() - startTime) / 1000} seconds`
        );
        if (json.msg) console.log("Notification:", json.msg);
        resolve(json);
      } else {
        console.error("❌ API error response:", json.error);
        reject(json.error);
      }
    } catch (error) {
      console.error("❌ API fetch failed:", error);
      reject(error);
    }
  });
}
