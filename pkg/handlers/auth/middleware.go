package auth

import (
	"context"
	"net/http"
)

/* Файл содержит функции для разграничения доступа к ресурсам (middleware) */

// Проверяет авторизирован ли пользователь, если да, то вызывает next
func (h *AuthHandler) RequireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		claims, err := h.ParseToken(r)
		if err != nil {
			http.Redirect(w, r, "/signin", http.StatusFound)
			return
		}

		user := &AuthorizedUser{
			ID:       int(claims["id"].(float64)),
			FullName: claims["fullname"].(string),
			Role:     claims["role"].(string),
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next(w, r.WithContext(ctx))
	}
}

// Проверяет имеет ли пользователь из контекста запроса указанную роль, если имеет
func (h *AuthHandler) RequireRoles(next http.HandlerFunc, roles []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctxUser := r.Context().Value(UserContextKey)
		if ctxUser == nil {
			h.helper.ClientError(w, http.StatusForbidden)
			return
		}

		user := ctxUser.(*AuthorizedUser)

		if !hasRole(roles, user.Role) {
			h.helper.ClientError(w, http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

// Обертка, чтобы проверять роли и авторизацию
func (h *AuthHandler) AccessWithRoles(next http.HandlerFunc, roles ...string) http.HandlerFunc {
	return h.RequireAuth(h.RequireRoles(next, roles))
}

// Проверяет есть ли среди разрешенных ролей указанная роль пользователя
func hasRole(allowedRoles []string, userRole string) bool {
	for _, role := range allowedRoles {
		if role == userRole {
			return true
		}
	}
	return false
}
