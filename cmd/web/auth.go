package main

import (
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func (app *application) createToken(role, fullname string) (string, error) {
	// Получаем секретный ключ для подписания
	key := app.JWTkey

	// Карта данных
	claims := jwt.MapClaims{
		"fullname": fullname,
		"role":     role,
		"exp":      time.Now().Add(time.Hour * 24).Unix(),
		"iat":      time.Now().Unix(),
	}

	// Создаем токен, подписываем и передаем строку в tokenString
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)
}

// Верификацирует токен и возвращает карту с полезной нагрузкой
func (app *application) verifyToken(tokenString string) (jwt.MapClaims, error) {
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (any, error) {
		return app.JWTkey, nil
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
