package auth

import (
	"context"
	"fmt"
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
			FullName: claims["fullname"].(string),
			Role:     claims["role"].(string),
		}

		ctx := context.WithValue(r.Context(), userContextKey, user)
		next(w, r.WithContext(ctx))
	}
}

// Проверяет имеет ли пользователь из контекста запроса указанную роль, если имеет
func (h *AuthHandler) RequireRoles(next http.HandlerFunc, roles []string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctxUser := r.Context().Value(userContextKey)
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
		fmt.Printf("userRole: %s\nroles: %s\n", userRole, role)
		if role == userRole {
			return true
		}
	}
	return false
}
