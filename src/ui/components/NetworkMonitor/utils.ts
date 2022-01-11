import {
  Header,
  RequestEventInfo,
  RequestInfo,
  RequestOpenEvent,
  RequestResponseEvent,
  TimeStampedPoint,
  RequestBodyEvent,
  RequestResponseBodyEvent,
} from "@recordreplay/protocol";
import keyBy from "lodash/keyBy";
import { compareNumericStrings } from "protocol/utils";

export type ContentType = "json" | "text" | "other";

export type RequestSummary = {
  domain: string;
  documentType: string;
  end: number;
  hasResponseBody: boolean;
  hasRequestBody: boolean;
  id: string;
  method: string;
  name: string;
  point: TimeStampedPoint;
  queryParams: [string, string][];
  triggerPoint: TimeStampedPoint | undefined;
  requestHeaders: Header[];
  responseHeaders: Header[];
  start: number;
  status: number;
  time: number;
  url: string;
};

export const REQUEST_TYPES = {
  xhr: "Fetch/XHR",
  javascript: "Javascript",
  html: "HTML",
  css: "CSS",
  font: "Font",
  img: "Image",
  manifest: "Manifest",
  media: "Media",
  other: "Other",
  wasm: "WASM",
  websocket: "Websocket",
};

export const findHeader = (headers: Header[] | undefined, key: string): string | undefined =>
  headers?.find(h => h.name.toLowerCase() === key)?.value;

export const REQUEST_ICONS: Record<string, string> = {
  xhr: "description",
  javascript: "code",
  css: "color_lens",
  font: "text_fields",
  html: "description",
  img: "perm_media",
  manifest: "description",
  media: "perm_media",
  other: "question_mark",
  wasm: "handyman",
  websocket: "autorenew",
};

export type RequestType = keyof typeof REQUEST_TYPES;

export type RequestEventMap = {
  request: { time: number; event: RequestOpenEvent };
  "response-body": { time: number; event: RequestResponseBodyEvent };
  "request-body": { time: number; event: RequestBodyEvent };
  response: { time: number; event: RequestResponseEvent };
};

export const eventsToMap = (events: RequestEventInfo[]): Partial<RequestEventMap> => {
  return keyBy(events, e => e.event.kind);
};

export const eventsByRequestId = (
  events: RequestEventInfo[]
): Record<string, RequestEventInfo[]> => {
  return events.reduce((acc: Record<string, RequestEventInfo[]>, eventInfo) => {
    acc[eventInfo.id] = [eventInfo, ...(acc[eventInfo.id] || [])];
    return acc;
  }, {});
};

const host = (url: string): string => new URL(url).host;
const name = (url: string): string =>
  new URL(url).pathname
    .split("/")
    .filter(f => f.length)
    .pop() || "";

const queryParams = (url: string): [string, string][] => {
  //@ts-ignore
  return Array.from(new URL(url).searchParams.entries() as [string, string][]);
};
const getDocumentType = (headers: Header[]): string => {
  const contentType = findHeader(headers, "content-type") || "unknown";
  // chop off any charset or other extra data
  return contentType.match(/^(.*)[,;]/)?.[1] || contentType;
};

export const partialRequestsToCompleteSummaries = (
  requests: RequestInfo[],
  events: RequestEventInfo[],
  types: Set<RequestType>
): RequestSummary[] => {
  const eventsMap = eventsByRequestId(events);
  const summaries = requests
    .map((r: RequestInfo) => ({ ...r, events: eventsToMap(eventsMap[r.id]) }))
    .filter(
      (r): r is RequestInfo & { events: RequestEventMap } =>
        !!r.events.request && !!r.events.response
    )
    .map((r: RequestInfo & { events: RequestEventMap }) => {
      const request = r.events.request;
      const response = r.events.response;
      const documentType = getDocumentType(response.event.responseHeaders);
      const type: RequestType = (documentType?.split("/")?.[1] || documentType) as RequestType;
      return {
        documentType,
        domain: host(request.event.requestUrl),
        end: response.time,
        hasResponseBody: Boolean(r.events["response-body"]),
        hasRequestBody: Boolean(r.events["request-body"]),
        id: r.id,
        method: request.event.requestMethod,
        name: name(request.event.requestUrl),
        point: {
          point: r.point,
          time: r.time,
        },
        queryParams: queryParams(request.event.requestUrl),
        requestHeaders: request.event.requestHeaders,
        responseHeaders: response.event.responseHeaders,
        start: request.time,
        status: response.event.responseStatus,
        time: response.time - request.time,
        triggerPoint: r.triggerPoint,
        type,
        url: request.event.requestUrl,
      };
    })
    .filter(row => {
      if (types.size === 0) {
        return true;
      }

      if (types.has(row.type)) {
        return true;
      }
      if (types.has("xhr") && row.type.match(/json/)) {
        return true;
      }

      if (types.has("font") && row.type.match(/(woff|ttf)/)) {
        return true;
      }

      if (types.has("img") && row.type.match(/(svg|jpeg|png|gif)/)) {
        return true;
      }
      return false;
    });

  summaries.sort((a, b) => compareNumericStrings(a.point.point, b.point.point));
  return summaries;
};

export function base64ToArrayBuffer(base64: string) {
  var binaryString = window.atob(base64);
  var len = binaryString.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const contentType = (headers: Header[]): ContentType => {
  const contentType = getDocumentType(headers);
  if (contentType?.startsWith("application/json")) {
    return "json";
  }
  if (contentType?.startsWith("text/")) {
    return "text";
  }
  return "other";
};
