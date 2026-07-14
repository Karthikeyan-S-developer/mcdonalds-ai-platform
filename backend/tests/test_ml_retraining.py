import unittest
from app.ml_services import ml_platform


class MLRetrainingTests(unittest.TestCase):
    def test_retraining_flags_are_set_and_cleared(self):
        ml_platform.last_retrain_at = None
        ml_platform.retrain_requested = False

        ml_platform.mark_retrain_requested()
        self.assertTrue(ml_platform.should_retrain())

        ml_platform.retrain_requested = False
        ml_platform.last_retrain_at = None
        self.assertTrue(ml_platform.should_retrain())

        ml_platform.last_retrain_at = ml_platform._now()
        self.assertFalse(ml_platform.should_retrain())


if __name__ == '__main__':
    unittest.main()
