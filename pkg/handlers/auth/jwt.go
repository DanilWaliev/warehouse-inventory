package auth

import (
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

/* Функции для работы с JWT токеном */

// Получает токен с запроса и возвращает мапу с полезной нагрузкой JWT токена
func (h *AuthHandler) ParseToken(r *http.Request) (jwt.MapClaims, error) {
	// Проверяем есть ли куки в HTTP запросе
	cookie, err := r.Cookie("jwt")
	if err != nil {
		return nil, err
	}
	tokenString := cookie.Value

	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return h.JWTkey, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))

	if err != nil {
		return nil, err
	}

	// Получаение карты полезной нагрузки из токена
	if claims, ok := token.Claims.(jwt.MapClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("неправильный токен")
}

// Получает роль и имя, возвращает новый токен для указанного имени и роли
func (h *AuthHandler) CreateToken(role, fullname string) (string, error) {
	// Получаем секретный ключ для подписания
	key := h.JWTkey

	// Карта данных
	claims := jwt.MapClaims{
		"fullname": fullname,
		"role":     role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
		"iat":      time.Now().Unix(),
	}

	fmt.Printf("%+v", claims)

	// Создаем токен, подписываем и передаем строку в tokenString
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)
}
