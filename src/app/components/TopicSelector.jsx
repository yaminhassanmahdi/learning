import Link from "next/link";
export default function TopicSelector() {
  return (
    <div className="flex min-h-screen justify-center items-center relative w-full bg-slate-200">
      <h1>What do you want to learn today?</h1>
      <div className="grid grid-cols-2 text-slate-900 text-2xl gap-5">
        <Link href="upload">
          <button className="p-6 rounded-lg bg-slate-50 cursor-pointer">
            Summarize Lectures
          </button>
        </Link>
        <Link href="upload">
          <button className="p-6 rounded-lg bg-slate-50 cursor-pointer">
            Generate lecture note
          </button>
        </Link>
        <Link href="upload">
          <button className="p-6 rounded-lg bg-slate-50 cursor-pointer">
            Generate flash cards
          </button>
        </Link>
        <Link href="upload">
          <button className="p-6 rounded-lg bg-slate-50 cursor-pointer">
            Give a quiz on a topic
          </button>
        </Link>
      </div>
    </div>
  );
}
