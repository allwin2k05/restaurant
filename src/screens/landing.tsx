import React from "react";

export const Landing = () => {
  return (
    <div className="w-screen h-screen overflow-hidden bg-[#0e0d0c]">
      <iframe
        src="/grilli-landing/index.html"
        title="Grilli Landing Page"
        className="w-full h-full border-none m-0 p-0"
      />
    </div>
  );
};
