# acl/permissions_catalog.py

PERMS = {
    # === ADMINISTRACIÓN / ACCESOS / SEGURIDAD ===
    "admin.access.manage": "admin.access.manage",
    "admin.audit.view": "admin.audit.view",
    "admin.audit.export": "admin.audit.export",

    # Catálogos
    "admin.catalogs.view": "admin.catalogs.view",
    "admin.catalogs.manage": "admin.catalogs.manage",

    "security.policies.manage": "security.policies.manage",
    "security.sessions.inspect": "security.sessions.inspect",

    # === ACADÉMICO ===
    "academic.plans.view": "academic.plans.view",
    "academic.plans.edit": "academic.plans.edit",
    "academic.sections.view": "academic.sections.view",
    "academic.sections.create": "academic.sections.create",
    "academic.sections.conflicts": "academic.sections.conflicts",
    "academic.enrollment.view": "academic.enrollment.view",
    "academic.enrollment.commit": "academic.enrollment.commit",
    "academic.grades.edit": "academic.grades.edit",
    "academic.grades.submit": "academic.grades.submit",
    "academic.grades.reopen": "academic.grades.reopen",
    "academic.syllabus.upload": "academic.syllabus.upload",
    "academic.syllabus.delete": "academic.syllabus.delete",
    "academic.evaluation.config": "academic.evaluation.config",
    "academic.kardex.view": "academic.kardex.view",
    "academic.reports.view": "academic.reports.view",
    "academic.attendance.view": "academic.attendance.view",
    "academic.attendance.edit": "academic.attendance.edit",
    "academic.acts.view": "academic.acts.view",
    "academic.acts.close": "academic.acts.close",
    "academic.acts.export": "academic.acts.export",

    # compat navegación
    "academic.view": "academic.view",
    "academic.plans.manage": "academic.plans.manage",
    "academic.sections.manage": "academic.sections.manage",
    "academic.grades.manage": "academic.grades.manage",
    "academic.attendance.manage": "academic.attendance.manage",
    "academic.processes.inbox.view": "academic.processes.inbox.view",

    # ============================
    # ✅ ESTUDIANTE (SELF vs MANAGE)
    # ============================

    # SELF: el estudiante solo ve/edita lo suyo
    "student.self.dashboard.view": "student.self.dashboard.view",
    "student.self.profile.view": "student.self.profile.view",
    "student.self.profile.edit": "student.self.profile.edit",
    "student.self.kardex.view": "student.self.kardex.view",
    "student.self.enrollment.view": "student.self.enrollment.view",

    # MANAGE: admin académico / admin system gestionan estudiantes
    "student.manage.list": "student.manage.list",
    "student.manage.view": "student.manage.view",
    "student.manage.edit": "student.manage.edit",
    "student.manage.enrollment": "student.manage.enrollment",
    "student.manage.kardex": "student.manage.kardex",

    # === ADMISIÓN ===
    "admission.calls.view": "admission.calls.view",
    "admission.calls.manage": "admission.calls.manage",
    "admission.applicants.manage": "admission.applicants.manage",
    "admission.documents.review": "admission.documents.review",
    "admission.schedule.manage": "admission.schedule.manage",
    "admission.evaluation.board": "admission.evaluation.board",
    "admission.results.publish": "admission.results.publish",
    "admission.payments.manage": "admission.payments.manage",
    "admission.reports.view": "admission.reports.view",
    "admission.certificates.issue": "admission.certificates.issue",
    "admission.dashboard.view": "admission.dashboard.view",
    "admission.applicant.profile.view": "admission.applicant.profile.view",

    # === MPV ===
    "mpv.processes.review": "mpv.processes.review",
    "mpv.processes.resolve": "mpv.processes.resolve",
    "mpv.files.upload": "mpv.files.upload",
    "mpv.reports.view": "mpv.reports.view",
    "mpv.public.intake": "mpv.public.intake",
    "mpv.public.tracking": "mpv.public.tracking",

    "desk.intake.manage": "desk.intake.manage",
    "desk.reports.view": "desk.reports.view",
    "desk.track.view": "desk.track.view",

    # === FINANZAS ===
    "fin.concepts.manage": "fin.concepts.manage",
    "fin.cashbanks.view": "fin.cashbanks.view",
    "fin.reconciliation.view": "fin.reconciliation.view",
    "fin.student.accounts.view": "fin.student.accounts.view",
    "fin.reports.view": "fin.reports.view",
    "fin.payments.receive": "fin.payments.receive",
    "fin.cash.movements": "fin.cash.movements",
    "fin.electronic.invoice.issue": "fin.electronic.invoice.issue",
    "fin.ar.manage": "fin.ar.manage",
    "fin.ap.manage": "fin.ap.manage",
    "fin.inventory.view": "fin.inventory.view",
    "fin.inventory.manage": "fin.inventory.manage",
    "fin.logistics.view": "fin.logistics.view",
    "logistics.procure.manage": "logistics.procure.manage",
    "logistics.warehouse.dispatch": "logistics.warehouse.dispatch",
    "hr.view": "hr.view",
    "hr.people.manage": "hr.people.manage",
    "hr.payroll.view": "hr.payroll.view",
    "finance.dashboard.view": "finance.dashboard.view",

    # === MINEDU ===
    "minedu.integration.view": "minedu.integration.view",
    "minedu.integration.export": "minedu.integration.export",
    "minedu.integration.validate": "minedu.integration.validate",
    "minedu.integrations.run": "minedu.integrations.run",

    # === PORTAL ===
    "portal.content.manage": "portal.content.manage",
    "portal.content.publish": "portal.content.publish",

    # === INVESTIGACIÓN ===
    "research.calls.view": "research.calls.view",
    "research.calls.manage": "research.calls.manage",
    "research.projects.view": "research.projects.view",
    "research.projects.edit": "research.projects.edit",
    "research.tabs.reports": "research.tabs.reports",

    # === SIA export ===
    "sia.export.enrollment": "sia.export.enrollment",
    "sia.export.grades": "sia.export.grades",
    "sia.export.certificates": "sia.export.certificates",
}

ROLE_POLICIES = {
    # ADMIN_SYSTEM: con todo
    "ADMIN_SYSTEM": list(PERMS.keys()),

    "ACCESS_ADMIN": [
        "admin.access.manage",
        "admin.audit.view",
        "admin.audit.export",
        "admin.catalogs.view",
        "admin.catalogs.manage",
    ],

    "SECURITY_ADMIN": [
        "security.policies.manage",
        "security.sessions.inspect",
        "admin.audit.view",
    ],

    # ✅ Admin Académico: académico + gestión de estudiantes
    "ADMIN_ACADEMIC": [
        "academic.plans.view", "academic.plans.edit",
        "academic.sections.view", "academic.sections.create", "academic.sections.conflicts",
        "academic.enrollment.view", "academic.enrollment.commit",
        "academic.grades.edit", "academic.grades.submit", "academic.grades.reopen",
        "academic.syllabus.upload", "academic.syllabus.delete",
        "academic.evaluation.config", "academic.kardex.view", "academic.reports.view",
        "academic.attendance.view", "academic.attendance.edit",
        "academic.acts.view", "academic.acts.close", "academic.acts.export",
        "sia.export.enrollment", "sia.export.grades", "sia.export.certificates",

        # compat navegación
        "academic.view", "academic.plans.manage", "academic.sections.manage",
        "academic.grades.manage", "academic.attendance.manage", "academic.processes.inbox.view",

        # ✅ Gestión de estudiantes (clave)
        "student.manage.list",
        "student.manage.view",
        "student.manage.edit",
        "student.manage.enrollment",
        "student.manage.kardex",
    ],

    "REGISTRAR": [
        "academic.sections.view", "academic.sections.create", "academic.sections.conflicts",
        "academic.grades.reopen", "academic.reports.view",
        "academic.acts.view", "academic.acts.close", "academic.acts.export",
        "sia.export.enrollment", "sia.export.grades",
        "academic.view", "academic.sections.manage",

        "admin.catalogs.view",
        "admin.catalogs.manage",
        # (opcional) si secretaría también gestiona estudiantes:
        # "student.manage.list",
        # "student.manage.view",
    ],

    "TEACHER": [
        "academic.sections.view",
        "academic.grades.edit", "academic.grades.submit",
        "academic.attendance.view", "academic.attendance.edit",
        "academic.syllabus.upload", "academic.evaluation.config",
        "academic.view", "academic.grades.manage", "academic.attendance.manage",
    ],

    # ✅ Estudiante: solo self (y compat con lo actual)
    "STUDENT": [
        "student.self.dashboard.view",
        "student.self.profile.view",
        "student.self.profile.edit",
        "student.self.kardex.view",
        "student.self.enrollment.view",

        # compat actual (si tus endpoints todavía validan academic.*)
        "academic.enrollment.view",
        "academic.enrollment.commit",
        "academic.kardex.view",
    ],

    "ADMISSION_OFFICER": [
        "admission.calls.view", "admission.calls.manage", "admission.applicants.manage",
        "admission.documents.review", "admission.schedule.manage",
        "admission.evaluation.board", "admission.results.publish",
        "admission.payments.manage", "admission.reports.view", "admission.certificates.issue",
        "admission.dashboard.view", "admission.applicant.profile.view",
    ],

    "MPV_OFFICER": [
        "mpv.processes.review", "mpv.files.upload", "mpv.reports.view",
        "desk.intake.manage", "desk.reports.view",
    ],

    "MPV_MANAGER": [
        "mpv.processes.review", "mpv.processes.resolve", "mpv.files.upload", "mpv.reports.view",
        "desk.intake.manage", "desk.reports.view",
    ],

    "CASHIER": [
        "fin.cashbanks.view", "fin.student.accounts.view",
        "fin.payments.receive", "fin.cash.movements", "finance.dashboard.view",
    ],

    "ACCOUNTANT": [
        "fin.reconciliation.view", "fin.reports.view", "fin.concepts.manage",
        "fin.electronic.invoice.issue", "fin.ar.manage", "fin.ap.manage", "finance.dashboard.view",
    ],

    "FINANCE_ADMIN": [
        "fin.cashbanks.view", "fin.student.accounts.view", "fin.reconciliation.view",
        "fin.reports.view", "fin.concepts.manage", "finance.dashboard.view",
        "fin.payments.receive", "fin.cash.movements",
        "fin.electronic.invoice.issue", "fin.ar.manage", "fin.ap.manage",
        "fin.inventory.manage",
    ],

    "WAREHOUSE": ["fin.inventory.view", "logistics.warehouse.dispatch"],
    "LOGISTICS": ["fin.logistics.view", "logistics.procure.manage"],
    "HR_ADMIN": ["hr.view", "hr.people.manage", "hr.payroll.view"],

    "MINEDU_INTEGRATION": [
        "minedu.integration.view", "minedu.integration.export", "minedu.integration.validate",
        "minedu.integrations.run",
    ],

    "PORTAL_ADMIN": ["portal.content.manage", "portal.content.publish"],

    "RESEARCH_COORDINATOR": [
        "research.calls.view", "research.calls.manage",
        "research.projects.view", "research.projects.edit", "research.tabs.reports",
    ],

    "TEACHER_RESEARCHER": ["research.projects.view", "research.projects.edit", "research.calls.view"],
    "CALLS_COMMITTEE": ["research.calls.view", "research.calls.manage"],
}

PERM_ALIASES = {
    # legacy desk -> mpv
    "desk.intake.manage": "mpv.processes.review",
    "desk.reports.view": "mpv.reports.view",
    "desk.track.view": "mpv.public.tracking",

    # Académico (manage -> granular)
    "academic.plans.manage": "academic.plans.edit",
    "academic.sections.manage": "academic.sections.create",
    "academic.grades.manage": "academic.grades.edit",
    "academic.attendance.manage": "academic.attendance.edit",
    "academic.view": "academic.sections.view",

    # ✅ Estudiante self -> compat academic
    "student.self.enrollment.view": "academic.enrollment.view",
    "student.self.kardex.view": "academic.kardex.view",

    # Minedu
    "minedu.integrations.run": "minedu.integration.export",
}
