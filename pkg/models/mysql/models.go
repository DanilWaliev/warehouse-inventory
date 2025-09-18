package mysql

import "database/sql"

/* Файл содержит структуру для сборки всех моделей в одно место */

// Собирает все модели в одну структуру для удобства использования
type MySQLModels struct {
	userModel      UserModel
	componentModel ComponentModel
}

// Конструктор
func NewMySQLModels(db *sql.DB) *MySQLModels {
	return &MySQLModels{
		userModel:      UserModel{DB: db},
		componentModel: ComponentModel{DB: db},
	}
}
