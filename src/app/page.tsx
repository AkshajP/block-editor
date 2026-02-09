import Editor from "@/components/Editor";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start bg-slate-50 p-24">
      <div className="w-full max-w-3xl">
        <h1 className="text-3xl font-bold mb-8 text-center text-slate-900">
          My Block Editor
        </h1>
        <Editor />
      </div>
    </main>
  );
}
