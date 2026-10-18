"""
Contradictome Test Suite
Tests API endpoints, dialectical reasoning engine, and graph generation.
"""

import json
import unittest
from app import app
from dialectic_engine import DialecticEngine
from literature_client import LiteratureClient

class TestContradictome(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        self.client.testing = True

    def test_index_page(self):
        """Test that the index web page renders successfully."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Contradictome', response.data)
        self.assertIn(b'Dialectical Evidence Graph', response.data)

    def test_get_benchmarks(self):
        """Test retrieving landmark benchmark controversies."""
        response = self.client.get('/api/benchmarks')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertGreaterEqual(len(data.get('benchmarks', [])), 3)

    def test_get_benchmark_detail(self):
        """Test retrieving detailed data for a specific controversy."""
        response = self.client.get('/api/benchmark/metformin_longevity')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        self.assertIn('graph', data.get('data', {}))
        self.assertIn('tie_breaker_experiment', data.get('data', {}))
        
        # Verify graph has nodes and edges
        graph = data['data']['graph']
        self.assertGreater(len(graph['nodes']), 0)
        self.assertGreater(len(graph['edges']), 0)

    def test_analyze_custom_hypothesis(self):
        """Test dialectical audit on a novel scientific hypothesis."""
        payload = {
            'hypothesis': 'Targeting KRAS G12D with small molecule inhibitors overcomes resistance in pancreatic ductal adenocarcinoma'
        }
        response = self.client.post('/api/analyze', json=payload)
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertTrue(data.get('success'))
        
        audit = data.get('data', {})
        self.assertIn('factor_matrix', audit)
        self.assertIn('tie_breaker_experiment', audit)
        self.assertIn('graph', audit)
        self.assertGreater(len(audit['graph']['nodes']), 0)

    def test_settings_flow(self):
        """Test updating and querying settings with Grok, OpenAI, and Anthropic keys."""
        # Query initial settings
        res_get = self.client.get('/api/settings')
        self.assertEqual(res_get.status_code, 200)
        get_data = json.loads(res_get.data)
        self.assertIn('has_grok', get_data)

        # Update with Grok key
        res_post = self.client.post('/api/settings', json={
            'grok_key': 'xai-mock-unit-test-key-12345',
            'model': 'grok-2-latest'
        })
        self.assertEqual(res_post.status_code, 200)
        post_data = json.loads(res_post.data)
        self.assertTrue(post_data.get('has_grok'))
        self.assertEqual(post_data.get('model'), 'grok-2-latest')

    def test_export_markdown_and_latex(self):
        """Test report exports in Markdown and LaTeX formats."""
        sample_data = {
            'title': 'Test Controversy',
            'hypothesis': 'Test Mechanism',
            'consensus_label': 'Disputed',
            'consensus_score': 45,
            'summary': 'Summary text',
            'root_contradiction': 'Mechanistic difference',
            'tie_breaker_experiment': {
                'title': 'Resolving Protocol',
                'design_type': 'Factorial Study',
                'independent_variables': ['Var A', 'Var B'],
                'dependent_variables': ['Metric 1'],
                'controls': ['Positive Control']
            }
        }

        # Test Markdown
        res_md = self.client.post('/api/export', json={'format': 'markdown', 'data': sample_data})
        self.assertEqual(res_md.status_code, 200)
        data_md = json.loads(res_md.data)
        self.assertIn('# Contradictome Dialectical', data_md['content'])

        # Test LaTeX
        res_tex = self.client.post('/api/export', json={'format': 'latex', 'data': sample_data})
        self.assertEqual(res_tex.status_code, 200)
        data_tex = json.loads(res_tex.data)
        self.assertIn(r'\documentclass{article}', data_tex['content'])

if __name__ == '__main__':
    unittest.main()
