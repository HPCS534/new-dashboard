import http from "k6/http";
import {check, fail} from "k6";
import {Rate, Trend} from "k6/metrics";

const backendUrl = __ENV.BACKEND_URL || "http://localhost:5153";
const supabaseUrl = __ENV.SUPABASE_URL;
const supabaseKey = __ENV.SUPABASE_PUBLISHABLE_KEY;
const email = __ENV.TEST_EMAIL;
const password = __ENV.TEST_PASSWORD;

const apiErrors = new Rate("api_errors");
const listDuration = new Trend("samples_list_duration", true);

export const options = {
    vus: Number(__ENV.VUS || 1),
    duration: __ENV.DURATION || "30s",
    thresholds: {
        http_req_failed: ["rate==0"],
        api_errors: ["rate==0"],
        samples_list_duration: ["p(95)<3000"],
    },
};

export function setup() {
    if (!supabaseUrl || !supabaseKey || !email || !password) {
        fail("Set SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, TEST_EMAIL, and TEST_PASSWORD.");
    }

    const response = http.post(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        JSON.stringify({email, password}),
        {
            headers: {
                "Content-Type": "application/json",
                apikey: supabaseKey,
            },
        },
    );

    check(response, {"Supabase login succeeded": (result) => result.status === 200});
    if (response.status !== 200) {
        fail(`Supabase login failed with HTTP ${response.status}.`);
    }

    return {accessToken: response.json("access_token")};
}

export default function (data) {
    const response = http.get(`${backendUrl}/api/samples`, {
        headers: {Authorization: `Bearer ${data.accessToken}`},
        tags: {operation: "list_samples"},
    });

    listDuration.add(response.timings.duration);
    const successful = check(response, {
        "samples request succeeded": (result) => result.status === 200,
        "samples response is an array": (result) => Array.isArray(result.json()),
    });
    apiErrors.add(!successful);
}
