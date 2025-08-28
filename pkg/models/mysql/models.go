package mysql

import "database/sql"

type MySQLModels struct {
	UserModel UserModel
}

func NewMySQLModels(db *sql.DB) *MySQLModels {
	return &MySQLModels{
		UserModel: UserModel{DB: db},
	}
}
