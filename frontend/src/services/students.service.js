import api from "../lib/api";

export const StudentsService = {
    list: (params) => api.get("/students", { params }).then(r => r.data),
    get: (id) => api.get(`/students/${id}`).then(r => r.data),
    update: (id, payload) => api.patch(`/students/${id}`, payload).then(r => r.data),

    uploadPhoto: (id, file) => {
        const fd = new FormData();
        fd.append("photo", file);
        return api.post(`/students/${id}/photo`, fd, {
            headers: { "Content-Type": "multipart/form-data" },
        }).then(r => r.data);
    },

    // ✅ NUEVO
    linkUser: (id, userId) =>
        api.post(`/students/${id}/link-user`, { user_id: userId }).then(r => r.data),

    me: () => api.get("/students/me").then(r => r.data),
    updateMe: (payload) => api.patch("/students/me", payload).then(r => r.data),
    uploadMyPhoto: (file) => {
        const fd = new FormData();
        fd.append("photo", file);
        return api.post("/students/me/photo", fd, {
            headers: { "Content-Type": "multipart/form-data" },
        }).then(r => r.data);
    },
};
