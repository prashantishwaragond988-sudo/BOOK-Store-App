from flask import Blueprint, jsonify

from config.firebase_config import db
from routes.auth import token_required, admin_required

admin_delivery_boys_list_bp = Blueprint('admin_delivery_boys_list', __name__)


@admin_delivery_boys_list_bp.route('/admin/deliveryboys/list', methods=['GET'])
@token_required
@admin_required
def list_delivery_boys(current_user):
    boys_ref = db.collection('deliveryBoys').stream()
    boys = [doc.to_dict() for doc in boys_ref]

    # Normalize fields for the UI
    results = []
    for b in boys:
        results.append({
            'id': b.get('uid') or b.get('id'),
            'uid': b.get('uid') or b.get('id'),
            'deliveryBoyId': b.get('deliveryBoyId') or b.get('deliveryBoyID') or b.get('id'),
            'name': b.get('name'),
            'email': b.get('email'),
            'phone': b.get('phone'),
            'vehicleType': b.get('vehicleType') or b.get('vehicle_type'),
            'active': b.get('active', True),
            'createdAt': b.get('createdAt') or b.get('created_at'),
            'createdAtRaw': b.get('createdAt'),
            'createdBy': b.get('createdBy') or b.get('created_by'),
        })

    return jsonify({'success': True, 'data': results}), 200
