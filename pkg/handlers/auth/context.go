package auth

/* Структуры для работы с контекстом запроса */

type contextKey string

const userContextKey = contextKey("user")

// Структура для хранения данных о пользователе в контексте
type AuthorizedUser struct {
	ID       int
	FullName string
	Role     string
}
