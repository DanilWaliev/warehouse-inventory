package models

import (
	"errors"
	"time"
)

/* Файл содержит определения общих "чистых" структур для хранения данных из БД в коде */

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

type Recipe struct {
	Result Component
	Items  []RecipeItem
}

type RecipeItem struct {
	Ingredient Component
	Quantity   int
}

type Order struct {
	ID        int
	CreatedAt *time.Time
	ClosedAt  *time.Time
	Items     []OrderItem
}

type OrderItem struct {
	Recipe   Recipe
	Quantity int
}

type Storage struct {
	ID        int
	Name      string
	Location  string
	Type      string
	Note      *string
	Inventory []StorageItem
}

type StorageItem struct {
	Component Component
	Quantity  int
}

type Document struct {
	ID                int
	Type              string
	CreatedAt         time.Time
	CreatedBy         int
	Notes             string
	MovementOrderID   *int
	ProductionOrderID *int
	Items             []DocumentItem
}

type DocumentItem struct {
	ID         int
	DocumentID int
	Component  Component
	Quantity   float64
}
