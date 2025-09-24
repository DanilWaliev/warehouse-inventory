package mysql

import (
	"database/sql"
	"errors"
	"warehouse-inventory/pkg/models"
)

type OrderModel struct {
	DB *sql.DB
}

func NewOrderModel(db *sql.DB) *OrderModel {
	return &OrderModel{
		DB: db,
	}
}

// Получить заказ по ID
func (m *OrderModel) SelectByID(id int, rm *RecipeModel) (*models.Order, error) {
	stmt := `SELECT ProductionOrder_ID, CreatedAt, ClosedAt
	         FROM productionorder
	         WHERE ProductionOrder_ID = ? AND ProductionSite_StorageSite_ID = 1`

	row := m.DB.QueryRow(stmt, id)

	o := &models.Order{}
	var closedAt sql.NullTime

	err := row.Scan(&o.ID, &o.CreatedAt, &closedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	if closedAt.Valid {
		o.ClosedAt = &closedAt.Time
	}

	// подгружаем позиции заказа
	stmt = `SELECT Recipe_Component_ID, Quantity 
	        FROM productionorderitem 
	        WHERE ProductionOrder_ID = ?`

	rows, err := m.DB.Query(stmt, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var recipeID, qty int
		if err := rows.Scan(&recipeID, &qty); err != nil {
			return nil, err
		}

		recipe, err := rm.SelectByID(recipeID)
		if err != nil {
			return nil, err
		}

		o.Items = append(o.Items, models.OrderItem{
			Recipe:   *recipe,
			Quantity: qty,
		})
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return o, nil
}

// Получить все заказы
func (m *OrderModel) SelectAll(rm *RecipeModel) ([]*models.Order, error) {
	stmt := `SELECT ProductionOrder_ID, CreatedAt, ClosedAt
	         FROM productionorder
	         WHERE ProductionSite_StorageSite_ID = 1
	         ORDER BY CreatedAt DESC`

	rows, err := m.DB.Query(stmt)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []*models.Order

	for rows.Next() {
		o := &models.Order{}
		var closedAt sql.NullTime

		if err := rows.Scan(&o.ID, &o.CreatedAt, &closedAt); err != nil {
			return nil, err
		}
		if closedAt.Valid {
			o.ClosedAt = &closedAt.Time
		}

		// подгружаем позиции для каждого заказа
		itemsStmt := `SELECT Recipe_Component_ID, Quantity 
		              FROM productionorderitem 
		              WHERE ProductionOrder_ID = ?`

		itemRows, err := m.DB.Query(itemsStmt, o.ID)
		if err != nil {
			return nil, err
		}

		for itemRows.Next() {
			var recipeID, qty int
			if err := itemRows.Scan(&recipeID, &qty); err != nil {
				itemRows.Close()
				return nil, err
			}

			recipe, err := rm.SelectByID(recipeID)
			if err != nil {
				itemRows.Close()
				return nil, err
			}

			o.Items = append(o.Items, models.OrderItem{
				Recipe:   *recipe,
				Quantity: qty,
			})
		}
		itemRows.Close()

		orders = append(orders, o)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return orders, nil
}

func (m *OrderModel) Insert(order *models.Order) error {
	// начинаем транзакцию
	tx, err := m.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// вставляем заказ
	stmt := `INSERT INTO productionorder (ProductionSite_StorageSite_ID) VALUES (1)`
	res, err := tx.Exec(stmt)
	if err != nil {
		return err
	}

	orderID, err := res.LastInsertId()
	if err != nil {
		return err
	}
	order.ID = int(orderID)

	// вставляем позиции заказа
	stmt = `INSERT INTO productionorderitem (ProductionOrder_ID, Recipe_Component_ID, Quantity)
	        VALUES (?, ?, ?)`
	for _, item := range order.Items {
		_, err = tx.Exec(stmt, order.ID, item.Recipe.Result.ID, item.Quantity)
		if err != nil {
			return err
		}
	}

	// коммитим
	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (m *OrderModel) Delete(id int) error {
	stmt := `DELETE FROM productionorder WHERE ProductionOrder_ID = ? AND ProductionSite_StorageSite_ID = 1`
	_, err := m.DB.Exec(stmt, id)
	return err
}

// Обновление заказа (менять список нельзя, только дату закрытия)
func (m *OrderModel) Update(id int) error {
	stmt := `UPDATE productionorder 
	         SET ClosedAt = CURRENT_TIMESTAMP
	         WHERE ProductionOrder_ID = ? AND ProductionSite_StorageSite_ID = 1`

	_, err := m.DB.Exec(stmt, id)
	return err
}
