import { handler } from "@/lib/auth/auth-server";
import { proxyAuthRequest } from "@/lib/auth/proxy";

export async function GET(request: Request): Promise<Response> {
  return proxyAuthRequest(request, handler.GET);
}

export async function POST(request: Request): Promise<Response> {
  return proxyAuthRequest(request, handler.POST);
}
