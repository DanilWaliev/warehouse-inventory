package main

import (
	"fmt"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

func (app *application) createToken(login, role string, w http.ResponseWriter) (string, error) {
	// Получаем секретный ключ для подписания
	key := app.JWTkey

	// Карта данных
	claims := jwt.MapClaims{
		"login": login,
		"role":  role,
		"exp":   time.Now().Add(time.Hour * 24).Unix(),
		"iat":   time.Now().Unix(),
	}

	// Создаем токен, подписываем и передаем строку в tokenString
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(key)

	// // Устанаваливаем токен в Cookie
	// http.SetCookie(w, &http.Cookie{
	// 	Name:     "jwt",
	// 	Value:    tokenString,
	// 	Path:     "/",
	// 	Expires:  time.Now().Add(24 * time.Hour),
	// 	Secure:   true,
	// 	SameSite: http.SameSiteStrictMode,
	// })

	// // Отправляем HTTP с кодом 200 (ОК) и json с
	// w.WriteHeader(http.StatusOK)
	// http.Redirect(w)

	// return nil
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

// Возвращает хеш пароля
func HashPassword(password string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}

	return string(hashed), nil
}

// true, если пароль подходит к хешу;
// false, если нет.
func CheckPassword(password, hash string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
	return err == nil
}
