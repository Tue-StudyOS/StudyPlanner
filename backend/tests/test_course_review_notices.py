import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import AsyncMock, patch

sys.path.append(str(Path(__file__).resolve().parents[1] / 'src'))

workers = types.ModuleType('workers')
workers.Response = object
sys.modules.setdefault('workers', workers)

from services import course_review_notices  # noqa: E402
from services.course_reviews import (  # noqa: E402
    CourseReviewAccessError,
    CourseReviewError,
    CourseReviewNotFoundError,
)


REVIEW = {
    'id': 17,
    'courseKey': 'INF-01',
    'username': 'author@example.test',
    'overallRating': 2,
    'comment': 'The course could be better organized.',
    'takenPeriodLabel': 'Sommer 2025',
    'lecturerName': 'Prof. Beispiel',
    'lecturerCustomName': None,
    'isHidden': 0,
    'createdAtUnix': 100,
    'updatedAtUnix': 100,
}


def _payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        'reviewId': 17,
        'category': 'privacy',
        'allegation': 'Private email disclosed',
        'explanation': 'The final sentence contains a private email address.',
        'contactEmail': 'reporter@example.test',
        'goodFaith': True,
    }
    payload.update(overrides)
    return payload


class NoticeValidationTest(unittest.TestCase):
    def test_build_notice_input_requires_complete_good_faith_contact(self) -> None:
        result = course_review_notices.build_notice_input(_payload())
        self.assertEqual(result['contactEmail'], 'reporter@example.test')

        with self.assertRaisesRegex(CourseReviewError, 'goodFaith'):
            course_review_notices.build_notice_input(_payload(goodFaith=False))
        with self.assertRaisesRegex(CourseReviewError, 'contactEmail'):
            course_review_notices.build_notice_input(_payload(contactEmail='invalid'))
        with self.assertRaisesRegex(CourseReviewError, 'explanation'):
            course_review_notices.build_notice_input(_payload(explanation='short'))

    def test_build_decision_input_requires_action_category_and_reason(self) -> None:
        decision = course_review_notices.build_decision_input(
            {
                'action': 'hide',
                'category': 'privacy',
                'reason': 'The review contains a private email address.',
            }
        )
        self.assertEqual(decision['action'], 'hide')


class NoticeWorkflowTest(unittest.IsolatedAsyncioTestCase):
    async def test_notice_queue_requires_the_moderator_boundary(self) -> None:
        with (
            patch.object(
                course_review_notices,
                'require_review_moderator',
                AsyncMock(side_effect=CourseReviewAccessError('forbidden')),
            ),
            patch.object(course_review_notices, 'fetch_all', AsyncMock()) as fetch_all,
            self.assertRaises(CourseReviewAccessError),
        ):
            await course_review_notices.list_review_notices(object(), object())

        fetch_all.assert_not_awaited()

    async def test_public_notice_stores_an_exact_snapshot_without_author_username(self) -> None:
        execute = AsyncMock()
        fetch_one = AsyncMock(side_effect=[REVIEW, {'id': 9, 'createdAtUnix': 123}])

        with (
            patch.object(course_review_notices, 'fetch_one', fetch_one),
            patch.object(course_review_notices, 'execute', execute),
            patch.object(course_review_notices, 'cleanup_expired_review_notices', AsyncMock()),
        ):
            result = await course_review_notices.submit_review_notice(
                object(), object(), _payload()
            )

        self.assertEqual(result['notice']['reference'], 'RN-9')
        parameters = execute.await_args.args[2]
        snapshot = json.loads(parameters[2])
        self.assertEqual(snapshot['reviewId'], 17)
        self.assertEqual(snapshot['comment'], REVIEW['comment'])
        self.assertNotIn('username', snapshot)
        self.assertEqual(parameters[-1], 'reporter@example.test')

    async def test_hidden_review_is_available_only_for_its_authenticated_author_redress(self) -> None:
        hidden_review = {**REVIEW, 'isHidden': 1}
        with (
            patch.object(course_review_notices, 'fetch_one', AsyncMock(return_value=hidden_review)),
            patch.object(
                course_review_notices,
                'get_authenticated_user',
                AsyncMock(return_value={'username': 'someone-else@example.test'}),
            ),
            self.assertRaises(CourseReviewNotFoundError),
        ):
            await course_review_notices.submit_review_notice(
                object(),
                object(),
                _payload(category='moderation_redress'),
            )

    async def test_reasoned_notice_decision_updates_notice_and_review_atomically(self) -> None:
        execute_batch = AsyncMock(return_value=[])
        fetch_one = AsyncMock(
            side_effect=[
                {'id': 9, 'reviewId': 17, 'status': 'received'},
                {'id': 17},
            ]
        )
        with (
            patch.object(
                course_review_notices,
                'require_review_moderator',
                AsyncMock(return_value='operator@example.test'),
            ),
            patch.object(course_review_notices, 'fetch_one', fetch_one),
            patch.object(course_review_notices, 'execute_batch', execute_batch),
        ):
            result = await course_review_notices.decide_review_notice(
                object(),
                object(),
                9,
                {
                    'action': 'hide',
                    'category': 'privacy',
                    'reason': 'The review contains a private email address.',
                },
            )

        self.assertEqual(result['status'], 'resolved')
        statements = execute_batch.await_args.args[1]
        self.assertEqual(len(statements), 2)
        self.assertIn("status = 'resolved'", statements[0][0])
        self.assertIn('moderation_reason', statements[1][0])
        self.assertEqual(statements[1][1][-1], 17)


if __name__ == '__main__':
    unittest.main()
