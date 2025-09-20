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
			h.helper.ClientError(w, http.StatusUnauthorized)
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
func (h *AuthHandler) RequireRole(next http.HandlerFunc, role string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		ctxUser := r.Context().Value(userContextKey)
		if ctxUser == nil {
			h.helper.ClientError(w, http.StatusForbidden)
			return
		}

		user := ctxUser.(*AuthorizedUser)

		if user.Role != role {
			h.helper.ClientError(w, http.StatusForbidden)
			return
		}

		next(w, r)
	}
}

func (h *AuthHandler) AccessWithRole(role string, next http.HandlerFunc) http.HandlerFunc {
	return h.RequireAuth(h.RequireRole(next, role))
}
