interface BaseInspectionFormProps {
  children: React.ReactNode;
  title: string;
  icon: string;
}

export const BaseInspectionForm = ({ children, title, icon }: BaseInspectionFormProps) => {
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
};