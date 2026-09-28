import { glueUnits } from "@/lib/text";

// Warnings and errors: a caution rule on the left, text in the normal colour.
export function Notices({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="mt-4 grid gap-2.5 first:mt-0">
      {messages.map((message) => (
        <li key={message} className="border-l-4 border-destructive py-0.5 pl-3">
          {glueUnits(message)}
        </li>
      ))}
    </ul>
  );
}
