package mysql

import "database/sql"

type RouteModel struct {
	DB *sql.DB
}

func NewRouteModel(db *sql.DB) *RouteModel {
	return &RouteModel{
		DB: db,
	}
}
