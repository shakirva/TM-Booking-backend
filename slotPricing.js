/**
 * Slot Pricing Module
 * Handles dynamic pricing with current price, future price, and effective date logic.
 * Automatically applies the correct price based on event date vs effective date.
 */

import pool from './db.js';

/**
 * Get the appropriate price for a slot based on the event date
 * @param {string} slotName - The slot name ('Lunch', 'Reception', or 'Night')
 * @param {string} eventDate - The event date in YYYY-MM-DD format
 * @returns {Promise<number>} The price to apply
 */
export async function getSlotPrice(slotName, eventDate) {
  try {
    const [rows] = await pool.query(
      'SELECT current_price, future_price, effective_from FROM slot_pricing WHERE slot_name = ?',
      [slotName]
    );
    
    if (!rows.length) {
      // Default prices if no database entry
      const defaults = {
        'Lunch': 40000,
        'Reception': 40000,
        'Night': 15000
      };
      return defaults[slotName] || 40000;
    }
    
    const { current_price, future_price, effective_from } = rows[0];
    
    // If future price and effective date are set, check if event date >= effective date
    if (future_price && effective_from) {
      const eventDateObj = new Date(eventDate);
      const effectiveFromObj = new Date(effective_from);
      
      // Reset time components for accurate date comparison
      eventDateObj.setHours(0, 0, 0, 0);
      effectiveFromObj.setHours(0, 0, 0, 0);
      
      if (eventDateObj >= effectiveFromObj) {
        return parseFloat(future_price);
      }
    }
    
    return parseFloat(current_price);
  } catch (error) {
    console.error('Error fetching slot price:', error);
    // Return default prices on error
    const defaults = {
      'Lunch': 40000,
      'Reception': 40000,
      'Night': 15000
    };
    return defaults[slotName] || 40000;
  }
}

/**
 * Get all slot pricing information
 * @returns {Promise<Array>} Array of all slot pricing records
 */
export async function getAllSlotPricing() {
  try {
    const [rows] = await pool.query(
      'SELECT id, slot_name, current_price, future_price, effective_from, updated_at FROM slot_pricing ORDER BY id'
    );
    return rows;
  } catch (error) {
    // If table doesn't exist, return default pricing
    if (error.code === 'ER_NO_SUCH_TABLE') {
      console.log('slot_pricing table does not exist, returning defaults');
      return [
        { id: 1, slot_name: 'Lunch', current_price: 40000, future_price: null, effective_from: null },
        { id: 2, slot_name: 'Reception', current_price: 40000, future_price: null, effective_from: null },
        { id: 3, slot_name: 'Night', current_price: 15000, future_price: null, effective_from: null }
      ];
    }
    console.error('Error fetching all slot pricing:', error);
    return [];
  }
}

/**
 * Update slot pricing
 * @param {string} slotName - The slot name to update
 * @param {object} pricing - Object containing current_price, future_price, effective_from
 * @returns {Promise<boolean>} Success status
 */
export async function updateSlotPricing(slotName, { current_price, future_price, effective_from }) {
  try {
    await pool.query(
      `INSERT INTO slot_pricing (slot_name, current_price, future_price, effective_from) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         current_price = VALUES(current_price),
         future_price = VALUES(future_price),
         effective_from = VALUES(effective_from),
         updated_at = CURRENT_TIMESTAMP`,
      [slotName, current_price, future_price || null, effective_from || null]
    );
    return true;
  } catch (error) {
    console.error('Error updating slot pricing:', error);
    return false;
  }
}

/**
 * Calculate total amount for a booking including night charges
 * @param {string} slotName - Main slot ('Lunch' or 'Reception')
 * @param {string} eventDate - Event date in YYYY-MM-DD format
 * @param {boolean} includeNight - Whether to include night charges
 * @returns {Promise<{slotPrice: number, nightPrice: number, totalAmount: number}>}
 */
export async function calculateTotalAmount(slotName, eventDate, includeNight = false) {
  const slotPrice = await getSlotPrice(slotName, eventDate);
  let nightPrice = 0;
  
  if (includeNight) {
    nightPrice = await getSlotPrice('Night', eventDate);
  }
  
  return {
    slotPrice,
    nightPrice,
    totalAmount: slotPrice + nightPrice
  };
}

export default {
  getSlotPrice,
  getAllSlotPricing,
  updateSlotPricing,
  calculateTotalAmount
};
