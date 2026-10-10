const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Writes res/values-he/strings.xml during prebuild. The React Native UI reads
 * its copy from src/lib/copy.ts; these resources cover the native app name and
 * the same inventory terms for Android's Hebrew locale.
 */
const STRINGS = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">מלאי החנות</string>
    <string name="stock">מלאי</string>
    <string name="scan_barcode">סרוק ברקוד</string>
    <string name="product_name">שם מוצר</string>
    <string name="quantity">כמות</string>
    <string name="add_product">הוסף מוצר</string>
    <string name="orders">הזמנות</string>
    <string name="draft_order">טיוטה</string>
    <string name="approved_delivered">אושר וסופק</string>
    <string name="confirm_delivery">אישור אספקה ללקוח</string>
    <string name="available_stock">זמין במלאי</string>
    <string name="reserved_stock">בהמתנה (בטיוטות)</string>
    <string name="low_stock_threshold">סף מלאי נמוך</string>
    <string name="quantity_over_time">שינוי כמות לאורך זמן</string>
    <string name="supplier_deliveries">אספקת סחורה</string>
    <string name="receive_shipment">קבלת סחורה למלאי</string>
    <string name="confirm_intake">אישור קבלת סחורה</string>
    <string name="intake_draft">טיוטת אספקה</string>
    <string name="quantity_added">כמות שנכנסה</string>
</resources>
`;

function withHebrewResources(config) {
  return withDangerousMod(config, [
    'android',
    (mod) => {
      const dir = path.join(mod.modRequest.platformProjectRoot, 'app/src/main/res/values-he');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'strings.xml'), STRINGS);
      return mod;
    },
  ]);
}

module.exports = withHebrewResources;
