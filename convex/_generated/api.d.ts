/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as appointments from "../appointments.js";
import type * as auth from "../auth.js";
import type * as campaigns from "../campaigns.js";
import type * as crons from "../crons.js";
import type * as customers from "../customers.js";
import type * as emails from "../emails.js";
import type * as estimates from "../estimates.js";
import type * as http from "../http.js";
import type * as inventory from "../inventory.js";
import type * as lib_customers from "../lib/customers.js";
import type * as lib_encryption from "../lib/encryption.js";
import type * as lib_password from "../lib/password.js";
import type * as lib_requireAdmin from "../lib/requireAdmin.js";
import type * as lib_validators from "../lib/validators.js";
import type * as marketingWebhook from "../marketingWebhook.js";
import type * as notifications from "../notifications.js";
import type * as staff from "../staff.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  appointments: typeof appointments;
  auth: typeof auth;
  campaigns: typeof campaigns;
  crons: typeof crons;
  customers: typeof customers;
  emails: typeof emails;
  estimates: typeof estimates;
  http: typeof http;
  inventory: typeof inventory;
  "lib/customers": typeof lib_customers;
  "lib/encryption": typeof lib_encryption;
  "lib/password": typeof lib_password;
  "lib/requireAdmin": typeof lib_requireAdmin;
  "lib/validators": typeof lib_validators;
  marketingWebhook: typeof marketingWebhook;
  notifications: typeof notifications;
  staff: typeof staff;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
