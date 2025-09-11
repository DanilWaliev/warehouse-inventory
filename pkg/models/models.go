package models

import (
	"errors"
	"time"
)

/* Файл содержит определения структур для хранения данных из БД в коде */

var ErrNoRecord error = errors.New("models: подходящей записи не найдено")

type Component struct {
	ID     int
	Name   string
	Weight float64
	Type   string
	Note   string
}

type User struct {
	ID           int
	Username     string
	PasswordHash string
	FullName     string
	Role         string
	Email        string
	Phone        string
	CreatedAt    time.Time
}
