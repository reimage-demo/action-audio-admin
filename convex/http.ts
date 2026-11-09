import { httpRouter } from "convex/server";
import { auth } from "./auth";
import { receive } from "./marketingWebhook";
const http = httpRouter();
auth.addHttpRoutes(http);
http.route({ path: "/brevo/marketing-events", method: "POST", handler: receive });
export default http;
