"use client";

export function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div style={{ marginBottom: "var(--space-8)" }}>
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "var(--space-2)" }}>
        {Array.from({ length: totalSteps }, (_, i) => {
          const step = i + 1;
          const isActive = step === currentStep;
          const isDone = step < currentStep;
          
          return (
            <div key={step} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: isDone ? "var(--accent)" : isActive ? "var(--accent)" : "var(--surface)",
                  color: isDone || isActive ? "white" : "var(--ink-soft)",
                  border: isActive ? "3px solid var(--accent)" : "2px solid var(--line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "1.1rem",
                }}
              >
                {isDone ? "✓" : step}
              </div>
              {step < totalSteps && (
                <div
                  style={{
                    width: 60,
                    height: 2,
                    background: isDone ? "var(--accent)" : "var(--line)",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
      <div style={{ textAlign: "center", marginTop: "var(--space-3)", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
        步骤 {currentStep} / {totalSteps}
      </div>
    </div>
  );
}
