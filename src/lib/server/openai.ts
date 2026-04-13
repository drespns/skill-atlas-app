type OpenAIResponseTextOutput = {
  type: "output_text";
  text: string;
};

type OpenAIResponse = {
  id: string;
  output?: Array<{ type: string; content?: Array<any> }>;
};

function env(name: string): string {
  const v = (import.meta as any).env?.[name];
  return typeof v === "string" ? v : "";
}

export function getOpenAiConfig(): { apiKey: string; model: string } {
  const apiKey = env("OPENAI_API_KEY");
  const model = env("OPENAI_MODEL") || "gpt-4.1-mini";
  return { apiKey, model };
}

export async function openAiRespondText(args: {
  apiKey: string;
  model: string;
  input: string;
}): Promise<{ text: string; error: string | null }> {
  try {
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${args.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: args.model,
        input: args.input,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { text: "", error: `OpenAI error (${res.status}): ${text || res.statusText}` };
    }

    const json = (await res.json().catch(() => null)) as OpenAIResponse | null;
    const outputs = json?.output ?? [];
    const parts: string[] = [];
    for (const out of outputs) {
      const content = Array.isArray(out?.content) ? out.content : [];
      for (const c of content) {
        if (c?.type === "output_text" && typeof (c as OpenAIResponseTextOutput).text === "string") {
          parts.push((c as OpenAIResponseTextOutput).text);
        }
      }
    }
    return { text: parts.join("\n").trim(), error: null };
  } catch (e: any) {
    return { text: "", error: e?.message ?? String(e) };
  }
}

