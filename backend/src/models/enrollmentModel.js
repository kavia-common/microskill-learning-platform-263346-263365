'use strict';

const { enrollUser, getEnrollmentsByUser } = require('../utils/db');

module.exports = {
  // PUBLIC_INTERFACE
  async enrollUserInLesson(userId, lessonId) {
    /** Enroll user in a lesson; idempotent. */
    return enrollUser(userId || 'anon', lessonId, 'active');
  },

  // PUBLIC_INTERFACE
  async getEnrollments(userId) {
    /** Fetch all enrollments for a user. */
    return getEnrollmentsByUser(userId || 'anon');
  }
};
