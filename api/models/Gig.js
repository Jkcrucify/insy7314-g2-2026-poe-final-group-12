const mongoose = require('mongoose');
const { GIG_CATEGORIES } = require('../utils/constants');

const gigSchema = new mongoose.Schema(
    {
        title: { type: String, required: true, trim: true, minlength: 5, maxlength: 100 },
        description: { type: String, required: true, trim: true, minlength: 20, maxlength: 1000 },
        category: { type: String, required: true, enum: GIG_CATEGORIES },
        price: { type: Number, required: true, min: 50, max: 100000 },
        deliveryDays: { type: Number, required: true, min: 1, max: 60 },
        freelancer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }
    },
    { timestamps: true }
);

gigSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    }
});

module.exports = mongoose.model('Gig', gigSchema);
