export default function ModuleLayout({
icon,
title,
description,
tabs,
children,
}) {
return (
    <div className="rounded-3xl bg-gradient-to-br from-slate-200 to-slate-400 p-4 shadow-xl">
    <div className="rounded-3xl bg-white/90 border border-slate-300 p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start gap-3">
            {icon}
            <div>
            <h2 className="text-xl font-semibold text-slate-800">
            {title}
            </h2>
            <p className="text-sm text-slate-600">
            {description}
            </p>
        </div>
        </div>

        {/* Tabs */}
        <div className="rounded-xl bg-slate-100 border border-slate-300 p-2">
        {tabs}
        </div>

        {/* Contenido */}
        <div className="space-y-6">
        {children}
        </div>

    </div>
    </div>
);
}
