import * as React from "react";
import { forwardRef } from "react";

type EquationEditorProps = {
  equation: string;
  inline: boolean;
  setEquation: (equation: string) => void;
};

function EquationEditor(
  { equation, setEquation, inline }: EquationEditorProps,
  forwardedRef: React.ForwardedRef<HTMLTextAreaElement | HTMLInputElement>,
): React.JSX.Element {
  const onChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setEquation(event.target.value);
  };

  if (inline) {
    return (
      <span className="inline-flex items-center bg-muted rounded px-1">
        <span className="text-muted-foreground mr-0.5">$</span>
        <input
          className="bg-transparent outline-none min-w-[2rem] text-sm font-mono"
          value={equation}
          onChange={onChange}
          autoFocus
          ref={forwardedRef as React.ForwardedRef<HTMLInputElement>}
        />
        <span className="text-muted-foreground ml-0.5">$</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start bg-muted rounded p-2 my-2">
      <span className="text-muted-foreground text-xs font-mono mb-1">$$</span>
      <textarea
        className="bg-transparent outline-none w-full min-h-[3rem] text-sm font-mono resize-y"
        value={equation}
        onChange={onChange}
        autoFocus
        ref={forwardedRef as React.ForwardedRef<HTMLTextAreaElement>}
      />
      <span className="text-muted-foreground text-xs font-mono mt-1">$$</span>
    </div>
  );
}

export default forwardRef(EquationEditor);
