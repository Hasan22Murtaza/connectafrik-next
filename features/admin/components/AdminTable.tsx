import { AP } from "../constants/adminLayout";

interface AdminTableProps {
  children: React.ReactNode;
  className?: string;
}

export function AdminTable({ children, className = "" }: AdminTableProps) {
  return (
    <div className={`${AP.card} overflow-hidden ${className}`}>
      <div className={AP.tableWrap}>
        <table className={AP.table}>{children}</table>
      </div>
    </div>
  );
}

export function AdminTableHead({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <thead className={`${AP.tableHead} ${className}`}>
      <tr>{children}</tr>
    </thead>
  );
}

export function AdminTableHeadCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <th className={`${AP.tableHeadCell} ${className}`}>{children}</th>;
}

export function AdminTableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function AdminTableRow({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <tr className={`${AP.tableRow} ${className}`}>{children}</tr>;
}

export function AdminTableCell({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`${AP.tableCell} ${className}`}>{children}</td>;
}

interface AdminTableCardProps {
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  highlight?: boolean;
}

export function AdminTableCard({
  title,
  action,
  children,
  highlight = false,
}: AdminTableCardProps) {
  return (
    <div className={`${AP.card} overflow-hidden`}>
      <div
        className={`px-4 sm:px-5 py-3.5 border-b border-gray-100 font-medium text-sm flex items-center justify-between gap-3 ${
          highlight ? "bg-amber-50/80 text-amber-900" : "bg-gray-50/60"
        }`}
      >
        <span>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
