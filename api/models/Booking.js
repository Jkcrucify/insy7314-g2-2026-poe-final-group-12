const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
    {
        gig: { type: mongoose.Schema.Types.ObjectId, ref: 'Gig', required: true },
        // Snapshot of the gig at booking time so history survives gig edits/deletion
        gigTitle: { type: String, required: true },
        client: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        amount: { type: Number, required: true, min: 0 },
        notes: { type: String, trim: true, maxlength: 500, default: '' },
        status: {
            type: String,
            enum: ['Confirmed', 'Completed', 'Cancelled'],
            default: 'Confirmed'
        }
    },
    { timestamps: true }
);

bookingSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Booking', bookingSchema);
