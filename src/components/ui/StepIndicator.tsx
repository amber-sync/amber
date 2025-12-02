import React from 'react';
import { Icons } from '../IconComponents';

interface Step {
  id: string | number;
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  variant?: 'horizontal' | 'vertical';
}

export const StepIndicator: React.FC<StepIndicatorProps> = ({
  steps,
  currentStep,
  onStepClick,
  variant = 'horizontal',
}) => {
  const isClickable = !!onStepClick;

  if (variant === 'vertical') {
    return (
      <div className="flex flex-col gap-0">
        {steps.map((step, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.id} className="flex">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && isCompleted && onStepClick(index)}
                  disabled={!isClickable || !isCompleted}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                    transition-all duration-normal shrink-0
                    ${
                      isCompleted
                        ? 'bg-gradient-primary text-white'
                        : isActive
                          ? 'bg-accent-primary text-accent-text ring-4 ring-accent-secondary'
                          : 'bg-layer-2 text-text-tertiary'
                    }
                    ${isClickable && isCompleted ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                  `}
                >
                  {isCompleted ? <Icons.Check size={16} strokeWidth={3} /> : index + 1}
                </button>
                {!isLast && (
                  <div
                    className={`w-0.5 h-12 my-1 transition-colors duration-normal ${
                      isCompleted ? 'bg-accent-primary' : 'bg-layer-3'
                    }`}
                  />
                )}
              </div>
              <div className="ml-4 pb-8">
                <p
                  className={`font-medium ${isActive ? 'text-text-primary' : 'text-text-secondary'}`}
                >
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-text-tertiary mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        const isLast = index === steps.length - 1;

        return (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => isClickable && isCompleted && onStepClick(index)}
                disabled={!isClickable || !isCompleted}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold
                  transition-all duration-normal
                  ${
                    isCompleted
                      ? 'bg-gradient-primary text-white'
                      : isActive
                        ? 'bg-accent-primary text-accent-text ring-4 ring-accent-secondary'
                        : 'bg-layer-2 text-text-tertiary'
                  }
                  ${isClickable && isCompleted ? 'cursor-pointer hover:scale-110' : 'cursor-default'}
                `}
              >
                {isCompleted ? <Icons.Check size={18} strokeWidth={3} /> : index + 1}
              </button>
              <p
                className={`mt-2 text-xs font-medium text-center ${isActive ? 'text-text-primary' : 'text-text-tertiary'}`}
              >
                {step.label}
              </p>
            </div>

            {!isLast && (
              <div className="flex-1 mx-4 -mt-6">
                <div
                  className={`h-0.5 w-full transition-colors duration-normal ${
                    isCompleted ? 'bg-accent-primary' : 'bg-layer-3'
                  }`}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
