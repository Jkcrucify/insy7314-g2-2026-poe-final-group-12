const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
    {
        reference: { type: String, required: true, unique: true },
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        amount: { type: Number, required: true, min: 0 },
        paymentMethod: { type: String, default: 'Simulated' },
        status: { type: String, enum: ['Success', 'Refunded'], default: 'Success' }
    },
    { timestamps: true }
);

transactionSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Transaction', transactionSchema);
