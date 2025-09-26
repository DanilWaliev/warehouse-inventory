package mysql

import "database/sql"

type StorageModel struct {
	DB *sql.DB
}

func NewStorageModel(db *sql.DB) *StorageModel {
	return &StorageModel{
		DB: db,
	}
}

// func (m *StorageModel) SelectBy
