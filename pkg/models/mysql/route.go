package mysql

import (
	"database/sql"
	"errors"

	"warehouse-inventory/pkg/models"
)

type RouteModel struct {
	DB *sql.DB
}

func NewRouteModel(db *sql.DB) *RouteModel {
	return &RouteModel{DB: db}
}

// SelectByID — получить один маршрут по ID.
// При отсутствии записи возвращает models.ErrNoRecord.
func (m *RouteModel) SelectByID(id int) (*models.Route, error) {
	const query = `
		SELECT
			Route_ID,
			FromSite_ID,
			ToSite_ID,
			TransitSite_ID,
			EstimatedDurationHours
		FROM movementroute
		WHERE Route_ID = ?`
	row := m.DB.QueryRow(query, id)

	r := &models.Route{}
	if err := row.Scan(&r.ID, &r.From.ID, &r.To.ID, &r.Transit.ID, &r.Edh); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, models.ErrNoRecord
		}
		return nil, err
	}
	return r, nil
}

// SelectAll — получить все маршруты (упорядочены по Route_ID ASC).
func (m *RouteModel) SelectAll() ([]*models.Route, error) {
	const query = `
		SELECT
			Route_ID,
			FromSite_ID,
			ToSite_ID,
			TransitSite_ID,
			EstimatedDurationHours
		FROM movementroute
		ORDER BY Route_ID ASC`
	rows, err := m.DB.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []*models.Route
	for rows.Next() {
		r := &models.Route{}
		if err := rows.Scan(&r.ID, &r.From.ID, &r.To.ID, &r.Transit.ID, &r.Edh); err != nil {
			return nil, err
		}
		res = append(res, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

// SelectByFromID — получить маршруты по складу-источнику.
func (m *RouteModel) SelectByFromID(id int) ([]*models.Route, error) {
	const query = `
		SELECT
			Route_ID,
			FromSite_ID,
			ToSite_ID,
			TransitSite_ID,
			EstimatedDurationHours
		FROM movementroute
		WHERE FromSite_ID = ?
		ORDER BY Route_ID ASC`
	rows, err := m.DB.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []*models.Route
	for rows.Next() {
		r := &models.Route{}
		if err := rows.Scan(&r.ID, &r.From.ID, &r.To.ID, &r.Transit.ID, &r.Edh); err != nil {
			return nil, err
		}
		res = append(res, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

// SelectByToID — получить маршруты по складу-получателю.
func (m *RouteModel) SelectByToID(id int) ([]*models.Route, error) {
	const query = `
		SELECT
			Route_ID,
			FromSite_ID,
			ToSite_ID,
			TransitSite_ID,
			EstimatedDurationHours
		FROM movementroute
		WHERE ToSite_ID = ?
		ORDER BY Route_ID ASC`
	rows, err := m.DB.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []*models.Route
	for rows.Next() {
		r := &models.Route{}
		if err := rows.Scan(&r.ID, &r.From.ID, &r.To.ID, &r.Transit.ID, &r.Edh); err != nil {
			return nil, err
		}
		res = append(res, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

// SelectByTransitID — получить маршруты по транзитному складу.
func (m *RouteModel) SelectByTransitID(id int) ([]*models.Route, error) {
	const query = `
		SELECT
			Route_ID,
			FromSite_ID,
			ToSite_ID,
			TransitSite_ID,
			EstimatedDurationHours
		FROM movementroute
		WHERE TransitSite_ID = ?
		ORDER BY Route_ID ASC`
	rows, err := m.DB.Query(query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var res []*models.Route
	for rows.Next() {
		r := &models.Route{}
		if err := rows.Scan(&r.ID, &r.From.ID, &r.To.ID, &r.Transit.ID, &r.Edh); err != nil {
			return nil, err
		}
		res = append(res, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return res, nil
}

// Insert — создать маршрут.
func (m *RouteModel) Insert(fromID, toID, transitID, edh int) error {
	const stmt = `
		INSERT INTO movementroute
			(FromSite_ID, ToSite_ID, TransitSite_ID, EstimatedDurationHours)
		VALUES (?, ?, ?, ?)`
	_, err := m.DB.Exec(stmt, fromID, toID, transitID, edh)
	return err
}

// Delete — удалить маршрут по ID.
func (m *RouteModel) Delete(id int) error {
	const stmt = `DELETE FROM movementroute WHERE Route_ID = ?`
	_, err := m.DB.Exec(stmt, id)
	return err
}
